-- Migration 0002 — AI usage & cost tracking.
-- Run this in the Supabase SQL editor (idempotent, safe to re-run).

-- Monthly budget on settings (used for the spend meter + flagging).
alter table public.user_settings
  add column if not exists monthly_budget_usd numeric not null default 10;

-- One row per paid API call.
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
