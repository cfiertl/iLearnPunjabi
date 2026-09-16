-- 0010_study_standard_roman.sql
-- The study session gains standard_roman, so the card back can show the
-- textbook form beneath the family form being graded. Display-only: nothing
-- about the queue changes. Body otherwise identical to 0008.
--
-- Idempotent: safe to re-run.

-- The RETURNS TABLE row type gains a column, and CREATE OR REPLACE cannot
-- change a function's OUT parameters. Drop first; recreated immediately below.
drop function if exists public.get_study_session(text);

create function public.get_study_session(p_mode text default 'production')
returns table (
  card_id             uuid,
  english_prompt      text,
  gurmukhi            text,
  roman               text,
  frame_tag           text,
  agreement_slot      text,
  slot_index_roman    integer,
  slot_index_gurmukhi integer,
  notes               text,
  box                 smallint,
  audio_url           text,
  audio_speaker       text,
  family_variant      text,
  verified            boolean,
  standard_roman      text
)
language sql
stable
as $$
  with introduced_today as (
    select count(*)::int as n
    from public.card_review_state s
    where s.user_id = auth.uid()
      and s.mode = p_mode
      and s.created_at >= public.my_day_start()
  ),
  eligible as (
    select c.id,
           c.created_at,
           (s.card_id is null) as is_new,
           coalesce(s.due_at, now()) as due_at,
           coalesce(s.box, 1::smallint) as box
    from public.cards c
    left join public.card_review_state s
      on s.card_id = c.id and s.mode = p_mode
    where c.user_id = auth.uid()
      and c.active
      and c.frame_tag is not null
      and (p_mode <> 'cloze' or c.agreement_slot is not null)
  ),
  due as (
    select e.id, e.due_at, e.box
    from eligible e
    where not e.is_new and e.due_at <= now()
  ),
  fresh as (
    select e.id, e.due_at, e.box
    from eligible e
    where e.is_new
    order by e.created_at
    limit greatest(
      public.my_new_per_day() - (select i.n from introduced_today i), 0)
  ),
  q as (
    select * from due
    union all
    select * from fresh
  )
  select c.id,
         c.english,
         c.gurmukhi,
         c.roman,
         c.frame_tag,
         c.agreement_slot,
         c.slot_index_roman,
         c.slot_index_gurmukhi,
         c.notes,
         q.box,
         a.url,
         a.speaker,
         c.family_variant,
         c.verified,
         c.standard_roman
  from public.cards c
  join q on q.id = c.id
  left join public.audio_clips a on a.id = c.audio_id
  order by q.due_at asc, q.box asc
  limit public.my_session_cap();
$$;
