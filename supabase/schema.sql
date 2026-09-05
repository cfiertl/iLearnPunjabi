-- ILearnPunjabi — database schema
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Single-user app, but every table is still locked to the owner via RLS.

-- ---------------------------------------------------------------------------
-- Decks: a named collection of cards (e.g. "A2 Core", "Family & Relationships")
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  description   text,
  level         text,                 -- CEFR-ish: A1, A2, B1...
  dialect_scope text default 'eastern', -- eastern | malaysian_sg | pakistani | mixed
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cards: one vocab item / phrase.
-- `gurmukhi` is stored for TTS/STT audio quality only and is NEVER shown to the
-- user — the UI renders `roman` (romanized) + `english`.
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id               uuid primary key default gen_random_uuid(),
  deck_id          uuid not null references public.decks (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  gurmukhi         text,              -- internal only (audio source of truth)
  roman            text not null,     -- shown to user
  english          text not null,     -- shown to user
  pos              text,              -- part of speech
  example_roman    text,
  example_english  text,
  audio_url        text,              -- pre-generated TTS in Supabase Storage
  variant_notes    jsonb default '{}'::jsonb, -- {"malaysian_sg": "...", "pakistani": "..."}
  tags             text[] default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists cards_deck_id_idx on public.cards (deck_id);

-- ---------------------------------------------------------------------------
-- Review state: FSRS scheduler state, one row per card (mirrors ts-fsrs Card).
-- ---------------------------------------------------------------------------
create table if not exists public.review_state (
  card_id         uuid primary key references public.cards (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  due             timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  elapsed_days    double precision not null default 0,
  scheduled_days  double precision not null default 0,
  learning_steps  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  state           smallint not null default 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review     timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists review_state_user_due_idx
  on public.review_state (user_id, due);

-- ---------------------------------------------------------------------------
-- Review logs: full history for streaks, analytics, and future FSRS optimizing.
-- ---------------------------------------------------------------------------
create table if not exists public.review_logs (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references public.cards (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  rating           smallint not null,  -- 1 Again, 2 Hard, 3 Good, 4 Easy
  state            smallint not null,
  due              timestamptz,
  stability        double precision,
  difficulty       double precision,
  elapsed_days     double precision,
  last_elapsed_days double precision,
  scheduled_days   double precision,
  reviewed_at      timestamptz not null default now()
);
create index if not exists review_logs_user_time_idx
  on public.review_logs (user_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Daily activity: one row per day studied — powers streaks & the calendar.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_activity (
  user_id          uuid not null references auth.users (id) on delete cascade,
  day              date not null,
  cards_reviewed   integer not null default 0,
  correct          integer not null default 0,
  seconds_studied  integer not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Per-user settings (goal, streak counters, TTS voice preference).
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  daily_goal     integer not null default 20,
  tts_voice      text,
  reminders      boolean not null default false,
  streak_current integer not null default 0,
  streak_best    integer not null default 0,
  last_studied   date,
  timezone       text default 'UTC',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only access on every table.
-- ---------------------------------------------------------------------------
alter table public.decks          enable row level security;
alter table public.cards          enable row level security;
alter table public.review_state   enable row level security;
alter table public.review_logs    enable row level security;
alter table public.daily_activity enable row level security;
alter table public.user_settings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'decks','cards','review_state','review_logs','daily_activity','user_settings'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I;', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-create default settings row when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Study queue: cards that are new (no review_state) or due now, due first.
-- SECURITY INVOKER (default) so RLS + auth.uid() still scope rows to the owner.
-- ---------------------------------------------------------------------------
create or replace function public.get_study_queue(p_limit int default 20)
returns setof public.cards
language sql
stable
as $$
  select c.*
  from public.cards c
  left join public.review_state r on r.card_id = c.id
  where c.user_id = auth.uid()
    and (r.card_id is null or r.due <= now())
  order by (r.card_id is null), r.due nulls last, c.created_at
  limit greatest(p_limit, 0);
$$;

-- Count of cards due (or new) right now — for the dashboard.
create or replace function public.count_due(p_dummy int default 0)
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.cards c
  left join public.review_state r on r.card_id = c.id
  where c.user_id = auth.uid()
    and (r.card_id is null or r.due <= now());
$$;

-- ---------------------------------------------------------------------------
-- Storage: bucket for pre-generated / cached TTS audio (public read).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('card-audio', 'card-audio', true)
on conflict (id) do nothing;

drop policy if exists "card-audio auth write" on storage.objects;
create policy "card-audio auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'card-audio');

drop policy if exists "card-audio auth update" on storage.objects;
create policy "card-audio auth update" on storage.objects
  for update to authenticated using (bucket_id = 'card-audio');

drop policy if exists "card-audio public read" on storage.objects;
create policy "card-audio public read" on storage.objects
  for select to public using (bucket_id = 'card-audio');

-- ---------------------------------------------------------------------------
-- AI usage & cost tracking (see migrations/0002_usage_tracking.sql).
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists monthly_budget_usd numeric not null default 10;

create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,        -- 'tts' | 'stt' | 'chat'
  provider   text,
  model      text,
  units      numeric,              -- chars / tokens / seconds
  unit_type  text,
  cost_usd   numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_time_idx
  on public.usage_events (user_id, created_at);

alter table public.usage_events enable row level security;
drop policy if exists usage_events_owner on public.usage_events;
create policy usage_events_owner on public.usage_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
