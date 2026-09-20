-- 0012_daily_review_budget.sql
-- The review cap becomes a budget for the DAY, not for each visit to /study.
--
-- The bug: `get_study_session` ended in `limit my_session_cap()` and nothing
-- upstream knew how much of that cap had already been spent. Once the backlog
-- grew past the cap -- the normal state of the deck -- every entry to the study
-- page handed out a fresh full 30. Doing twelve, stopping, and coming back gave
-- thirty again, so a partly finished day could never be finished: the counter
-- reset to the day's baseline every time. Backing out early was therefore
-- impossible to do without losing the sense of where the day stood.
--
-- The fix: count what has already been reviewed since the learner's midnight
-- and subtract it. Twelve done, exit, return -> eighteen left; finish those and
-- the day's set is complete. `p_ignore_daily_cap` deliberately keeps the door
-- open for a second session past the budget -- the cap is a floor under the
-- habit, not a lockout.
--
-- Bodies are otherwise identical to 0006 (count) and 0010 (session).
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- How much of today's budget is spent, and what is left.
--
-- Counted from review_events, the append-only record, rather than from
-- card_review_state.last_reviewed_at: a state row holds only the latest review,
-- so a card graded and then re-graded would erase the earlier one from the
-- tally. DISTINCT card_id so a single card cannot eat two slots.
-- ---------------------------------------------------------------------------
create or replace function public.my_reviews_today(p_mode text default 'production')
returns int
language sql
stable
as $$
  select count(distinct e.card_id)::int
  from public.review_events e
  where e.user_id = auth.uid()
    and e.mode = p_mode
    and e.reviewed_at >= public.my_day_start();
$$;

create or replace function public.my_remaining_today(p_mode text default 'production')
returns int
language sql
stable
as $$
  select greatest(
    public.my_session_cap() - public.my_reviews_today(p_mode), 0);
$$;

-- ---------------------------------------------------------------------------
-- Due count, now capped by what is left of today rather than uncapped.
-- The home screen's number and the queue the study page actually serves were
-- two different quantities before this; they are the same one now.
-- ---------------------------------------------------------------------------
-- Gains a parameter, so the old one-argument signature must go or a call that
-- passes only p_mode becomes ambiguous between the two. The new signature is
-- dropped as well, since CREATE FUNCTION would otherwise collide with itself on
-- a re-run.
drop function if exists public.count_due_reviews(text);
drop function if exists public.count_due_reviews(text, boolean);

create function public.count_due_reviews(
  p_mode             text    default 'production',
  p_ignore_daily_cap boolean default false
)
returns int
language sql
stable
as $$
  with eligible as (
    select (s.card_id is null) as is_new,
           coalesce(s.due_at, now()) as due_at
    from public.cards c
    left join public.card_review_state s
      on s.card_id = c.id and s.mode = p_mode
    where c.user_id = auth.uid()
      and c.active
      and c.frame_tag is not null
      and (p_mode <> 'cloze' or c.agreement_slot is not null)
  ),
  introduced as (
    select count(*)::int as n
    from public.card_review_state s
    where s.user_id = auth.uid()
      and s.mode = p_mode
      and s.created_at >= public.my_day_start()
  ),
  waiting as (
    select (select count(*)::int from eligible e
              where not e.is_new and e.due_at <= now())
         + least(
             (select count(*)::int from eligible e where e.is_new),
             greatest(
               public.my_new_per_day() - (select i.n from introduced i), 0)
           ) as n
  )
  -- Capped: what the study page will hand over now. Uncapped: the real
  -- backlog, which is what "and there is still this much waiting" has to
  -- report -- capping that number too would understate it and call it fact.
  select case
           when p_ignore_daily_cap then (select w.n from waiting w)
           else least((select w.n from waiting w),
                      public.my_remaining_today(p_mode))
         end;
$$;

-- ---------------------------------------------------------------------------
-- The session queue itself. Only the final LIMIT changes.
-- ---------------------------------------------------------------------------
drop function if exists public.get_study_session(text);
drop function if exists public.get_study_session(text, boolean);

create function public.get_study_session(
  p_mode             text    default 'production',
  p_ignore_daily_cap boolean default false
)
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
  limit (case
            when p_ignore_daily_cap then public.my_session_cap()
            else public.my_remaining_today(p_mode)
          end);
$$;
