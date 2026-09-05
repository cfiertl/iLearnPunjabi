-- 0006_learner_timezone.sql
-- Move the day boundary from the server's timezone to the learner's.
--
-- Serverless functions run in UTC, so "today" and "due tomorrow" were anchored
-- to UTC midnight — 10am in Sydney. The morning review session, the one slot the
-- routine says cannot slip, therefore missed cards that should have been waiting,
-- and the ten-new-cards-a-day budget reset mid-morning.
--
-- The scheduling half of this is fixed in src/lib/leitner.ts, which now takes the
-- learner timezone from the browser. This is the SQL half: the new-card throttle
-- counts what was introduced "today", and today has to mean their day.
--
-- Idempotent: safe to re-run.

-- Learner timezone, falling back to UTC when unset or nonsense. user_settings
-- already carried a `timezone` column, unused until now; submitGrade keeps it
-- current from the browser.
create or replace function public.my_timezone()
returns text
language plpgsql
stable
as $$
declare
  tz text;
begin
  select s.timezone into tz
  from public.user_settings s
  where s.user_id = auth.uid();

  if tz is null or tz = '' then
    return 'UTC';
  end if;

  -- Reject anything Postgres does not recognise rather than erroring mid-query.
  perform now() at time zone tz;
  return tz;
exception
  when others then
    return 'UTC';
end $$;

-- Start of the learner's current day, as a timestamptz.
create or replace function public.my_day_start()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('day', now() at time zone public.my_timezone())
          at time zone public.my_timezone());
$$;

-- ---------------------------------------------------------------------------
-- Rebuild the two functions whose "today" window was UTC-anchored.
-- Bodies are otherwise unchanged from 0004.
-- ---------------------------------------------------------------------------
create or replace function public.count_due_reviews(p_mode text default 'production')
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
  )
  select (select count(*)::int from eligible e
           where not e.is_new and e.due_at <= now())
       + least(
           (select count(*)::int from eligible e where e.is_new),
           greatest(public.my_new_per_day() - (select i.n from introduced i), 0)
         );
$$;

create or replace function public.get_study_session(p_mode text default 'production')
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
  audio_speaker       text
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
         a.speaker
  from public.cards c
  join q on q.id = c.id
  left join public.audio_clips a on a.id = c.audio_id
  order by q.due_at asc, q.box asc
  limit public.my_session_cap();
$$;

-- The 7-day forecast buckets by date and is display-only, so a shifted boundary
-- there is cosmetic; aligned anyway for consistency.
create or replace function public.stats_forecast()
returns table (day date, due int)
language sql
stable
as $$
  select (due_at at time zone public.my_timezone())::date as day,
         count(*)::int as due
  from public.card_review_state
  where user_id = auth.uid()
    and due_at < public.my_day_start() + interval '8 days'
  group by 1
  order by 1;
$$;
