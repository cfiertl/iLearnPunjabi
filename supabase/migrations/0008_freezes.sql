-- 0008_freezes.sql
-- Freeze capture: moments the learner wanted to say something and could not.
--
-- These decide curriculum order, so capture friction degrades the whole system.
-- The table is deliberately dumb — English text and a timestamp. Everything
-- else (bucket, note, resolution) is added later, at triage.
--
-- Idempotent: safe to re-run.

create table if not exists public.freezes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  english     text not null,
  captured_at timestamptz not null default now(),
  -- null until triaged. A: missing a word. B: missing a frame. C: knew it, froze.
  bucket      text check (bucket in ('A', 'B', 'C')),
  note        text,
  -- carded, or consciously discarded. Discarding is a normal outcome.
  resolved    boolean not null default false
);

create index if not exists freezes_user_time_idx
  on public.freezes (user_id, captured_at desc);

-- The triage queue: untriaged and not yet discarded.
create index if not exists freezes_untriaged_idx
  on public.freezes (user_id, captured_at)
  where bucket is null and not resolved;

alter table public.freezes enable row level security;

drop policy if exists freezes_owner on public.freezes;
create policy freezes_owner on public.freezes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Card additions (addendum section 7).
--
-- freeze_id models the spec's `cardIds` from the other side: one freeze yields
-- several cards, each card comes from at most one freeze, so the link lives on
-- the card and the id list is derived. Display-only either way — it must not
-- touch scheduling, selection or grading.
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists freeze_id uuid
    references public.freezes (id) on delete set null,
  -- How the family actually says it. Where present, this is the authoritative
  -- form. Display-only: it does not affect cloze slots or grading.
  add column if not exists family_variant text,
  -- Gurmukhi orthography checked by a reader.
  add column if not exists verified boolean not null default false;

create index if not exists cards_freeze_idx
  on public.cards (freeze_id) where freeze_id is not null;

-- Count of untriaged freezes, for the capture button badge.
create or replace function public.count_untriaged_freezes()
returns int
language sql
stable
as $$
  select count(*)::int
  from public.freezes
  where user_id = auth.uid()
    and bucket is null
    and not resolved;
$$;

-- ---------------------------------------------------------------------------
-- Study session gains family_variant and verified. Body otherwise unchanged
-- from 0006 -- both fields are display-only and touch nothing about the queue.
-- ---------------------------------------------------------------------------
-- The RETURNS TABLE row type gains two columns, and CREATE OR REPLACE cannot
-- change a function's OUT parameters. Drop first. Safe: it is a function, not
-- data, and it is recreated immediately below.
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
  verified            boolean
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
         c.verified
  from public.cards c
  join q on q.id = c.id
  left join public.audio_clips a on a.id = c.audio_id
  order by q.due_at asc, q.box asc
  limit public.my_session_cap();
$$;
