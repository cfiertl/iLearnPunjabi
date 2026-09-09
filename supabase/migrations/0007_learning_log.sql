-- 0007_learning_log.sql
-- A record of which parts of the routine actually happened.
--
-- Deliberately a LOG, not a streak: no chain to protect, no counter to keep
-- alive. buildplan.md rules out gamification, and the point here is the same as
-- review_events — being able to see what you actually did, so a routine that is
-- quietly not happening becomes visible.
--
-- Card work is NOT stored here. It is already recorded in review_events, so it
-- is derived rather than duplicated; only the sessions the app cannot observe
-- are entered by hand.
--
-- Idempotent: safe to re-run.

create table if not exists public.learning_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  kind        text not null check (kind in ('sbs', 'gurmukhi', 'session', 'solo')),
  minutes     integer,
  notes       text,
  created_at  timestamptz not null default now()
);

-- One entry per kind per day; logging the same thing twice just updates it.
create unique index if not exists learning_sessions_day_kind_key
  on public.learning_sessions (user_id, occurred_on, kind);

create index if not exists learning_sessions_user_day_idx
  on public.learning_sessions (user_id, occurred_on);

alter table public.learning_sessions enable row level security;

drop policy if exists learning_sessions_owner on public.learning_sessions;
create policy learning_sessions_owner on public.learning_sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Today, in the learner's timezone — so the log agrees with the day boundary
-- the scheduler uses.
-- ---------------------------------------------------------------------------
create or replace function public.my_today()
returns date
language sql
stable
as $$
  select (now() at time zone public.my_timezone())::date;
$$;

-- ---------------------------------------------------------------------------
-- Card work, derived from the review log rather than recorded separately.
-- ---------------------------------------------------------------------------
create or replace function public.log_card_days(p_days int default 28)
returns table (day date, reviews int)
language sql
stable
as $$
  select (e.reviewed_at at time zone public.my_timezone())::date as day,
         count(*)::int as reviews
  from public.review_events e
  where e.user_id = auth.uid()
    and e.reviewed_at >= public.my_day_start() - make_interval(days => p_days)
  group by 1
  order by 1;
$$;
