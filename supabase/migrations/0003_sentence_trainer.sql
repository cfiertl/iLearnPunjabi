-- 0003_sentence_trainer.sql
-- Converts the app from a vocabulary trainer into a SENTENCE PRODUCTION trainer
-- instrumented on grammatical agreement (see buildplan.md).
--
-- Deliberately ADDITIVE. The Phase-1 FSRS tables (review_state, review_logs,
-- daily_activity) are left completely untouched so no history is lost; they are
-- simply no longer read by the app. Legacy word-level cards stay in `cards` but
-- fall out of every new query because their `frame_tag` is null.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Cards gain the sentence / agreement fields.
-- `english` doubles as the build spec englishPrompt; `roman` and `gurmukhi`
-- already exist. Gurmukhi is now rendered to the user -- the build spec
-- supersedes the old "never show Gurmukhi" rule.
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists frame_tag           text,
  add column if not exists agreement_slot      text,
  add column if not exists slot_index_roman    integer,
  add column if not exists slot_index_gurmukhi integer,
  add column if not exists notes               text,
  add column if not exists active              boolean not null default true;

-- Sentence cards are identified by having a frame_tag.
create index if not exists cards_frame_tag_idx
  on public.cards (user_id, frame_tag) where frame_tag is not null;

-- Idempotent import key: same prompt + same sentence = same card.
-- Scoped to sentence cards so pre-existing word-level rows can never collide,
-- and so this migration cannot fail on legacy data.
create unique index if not exists cards_user_prompt_gurmukhi_key
  on public.cards (user_id, english, gurmukhi)
  where frame_tag is not null;

-- ---------------------------------------------------------------------------
-- Audio clips: human recordings (family voices), the highest-value asset here.
-- The blob lives in the card-audio Storage bucket; this row is the metadata,
-- because speaker attribution matters later.
-- ---------------------------------------------------------------------------
create table if not exists public.audio_clips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  url          text not null,
  speaker      text not null,
  duration_ms  integer not null default 0,
  recorded_at  timestamptz not null default now()
);
create index if not exists audio_clips_user_idx on public.audio_clips (user_id);

alter table public.cards
  add column if not exists audio_id uuid
  references public.audio_clips (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Review state: ONE ROW PER (card, mode). A card carries two independent
-- schedules -- production and cloze.
-- ---------------------------------------------------------------------------
create table if not exists public.card_review_state (
  card_id          uuid not null references public.cards (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  mode             text not null check (mode in ('production', 'cloze')),
  box              smallint not null default 1 check (box between 1 and 5),
  due_at           timestamptz not null default now(),
  lapses           integer not null default 0,
  agreement_fails  integer not null default 0,
  last_grade       text check (last_grade in ('correct', 'agreement', 'fail')),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  primary key (card_id, mode)
);
create index if not exists card_review_state_due_idx
  on public.card_review_state (user_id, mode, due_at);

-- ---------------------------------------------------------------------------
-- Review events: APPEND-ONLY diagnostic record. Never mutated, never pruned --
-- enforced below by granting select + insert only.
-- `frame_tag` is denormalised for cheap aggregation.
-- ---------------------------------------------------------------------------
create table if not exists public.review_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  card_id     uuid not null references public.cards (id) on delete cascade,
  mode        text not null check (mode in ('production', 'cloze')),
  grade       text not null check (grade in ('correct', 'agreement', 'fail')),
  frame_tag   text not null,
  box_before  smallint not null,
  box_after   smallint not null,
  reviewed_at timestamptz not null default now()
);
create index if not exists review_events_user_time_idx
  on public.review_events (user_id, reviewed_at);
create index if not exists review_events_frame_idx
  on public.review_events (user_id, frame_tag);

-- ---------------------------------------------------------------------------
-- Session preferences: 30-review cap, 10 new/day, flip friction beat.
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists session_cap   integer not null default 30,
  add column if not exists new_per_day   integer not null default 10,
  add column if not exists flip_delay_ms integer not null default 1500;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.audio_clips       enable row level security;
alter table public.card_review_state enable row level security;
alter table public.review_events     enable row level security;

drop policy if exists audio_clips_owner on public.audio_clips;
create policy audio_clips_owner on public.audio_clips
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists card_review_state_owner on public.card_review_state;
create policy card_review_state_owner on public.card_review_state
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Append-only: read + insert, deliberately NO update or delete policy.
drop policy if exists review_events_owner on public.review_events;
drop policy if exists review_events_read on public.review_events;
drop policy if exists review_events_append on public.review_events;
create policy review_events_read on public.review_events
  for select to authenticated using (user_id = auth.uid());
create policy review_events_append on public.review_events
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Due queue. Due states first (due_at asc, then box asc so strugglers surface),
-- with unseen cards appended at box 1, throttled to the daily new-card budget.
-- ---------------------------------------------------------------------------
create or replace function public.get_review_queue(
  p_mode      text default 'production',
  p_limit     int  default 30,
  p_new_limit int  default 10
)
returns setof public.cards
language sql
stable
as $$
  with introduced_today as (
    select count(*)::int as n
    from public.card_review_state s
    where s.user_id = auth.uid()
      and s.mode = p_mode
      and s.created_at >= date_trunc('day', now())
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
    select id, due_at, box from eligible
    where not is_new and due_at <= now()
  ),
  fresh as (
    select id, due_at, box from eligible
    where is_new
    order by created_at
    limit greatest((select p_new_limit - n from introduced_today), 0)
  ),
  queue as (
    select * from due
    union all
    select * from fresh
  )
  select c.*
  from public.cards c
  join queue q on q.id = c.id
  order by q.due_at asc, q.box asc
  limit greatest(p_limit, 0);
$$;

-- How many reviews are waiting right now (same rules as the queue).
create or replace function public.count_review_queue(
  p_mode      text default 'production',
  p_new_limit int  default 10
)
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.get_review_queue(p_mode, 1000000, p_new_limit);
$$;

-- ---------------------------------------------------------------------------
-- Statistics: is the agreement problem shrinking?
-- ---------------------------------------------------------------------------

-- Headline: agreement-fail share of all events, bucketed weekly.
create or replace function public.stats_weekly_agreement()
returns table (week_start date, total int, agreement int)
language sql
stable
as $$
  select date_trunc('week', reviewed_at)::date as week_start,
         count(*)::int as total,
         count(*) filter (where grade = 'agreement')::int as agreement
  from public.review_events
  where user_id = auth.uid()
  group by 1
  order by 1;
$$;

-- Which structure is unresolved? Trend = last 30d rate vs the 30d before it.
-- A rate of -1 means "no data in that window" (renders as no arrow).
create or replace function public.stats_by_frame()
returns table (
  frame_tag   text,
  total       int,
  agreement   int,
  recent_rate numeric,
  prior_rate  numeric
)
language sql
stable
as $$
  select e.frame_tag,
         count(*)::int as total,
         count(*) filter (where e.grade = 'agreement')::int as agreement,
         coalesce(avg(case when e.reviewed_at >= now() - interval '30 days'
                           then (e.grade = 'agreement')::int end)::numeric,
                  -1) as recent_rate,
         coalesce(avg(case when e.reviewed_at <  now() - interval '30 days'
                            and e.reviewed_at >= now() - interval '60 days'
                           then (e.grade = 'agreement')::int end)::numeric,
                  -1) as prior_rate
  from public.review_events e
  where e.user_id = auth.uid()
  group by e.frame_tag
  order by (count(*) filter (where e.grade = 'agreement'))::numeric
             / greatest(count(*), 1) desc,
           count(*) desc;
$$;

-- Next 7 days of scheduled reviews, for the small forecast block.
create or replace function public.stats_forecast()
returns table (day date, due int)
language sql
stable
as $$
  select due_at::date as day, count(*)::int as due
  from public.card_review_state
  where user_id = auth.uid()
    and due_at < date_trunc('day', now()) + interval '8 days'
  group by 1
  order by 1;
$$;
