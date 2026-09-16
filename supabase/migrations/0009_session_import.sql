-- 0009_session_import.sql
-- Session import: one file per tutoring session, written by Claude, carrying
-- every card and freeze change that session decided. It becomes the single
-- write path for triage, so the export can never drift from what was agreed.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Freezes gain an outcome. Bucket says WHY it froze; outcome says what was
-- done about it. The same bucket can end in different places, so they are
-- separate columns.
-- ---------------------------------------------------------------------------
alter table public.freezes
  add column if not exists outcome text
    check (outcome in ('carded', 'existing_card', 'parked', 'discarded')),
  -- The frame a parked freeze is waiting to be taught. Set iff parked.
  add column if not exists waiting_on text,
  add column if not exists triaged_at timestamptz,
  -- The import batch that last changed this freeze.
  add column if not exists batch_id text;

alter table public.freezes drop constraint if exists freezes_waiting_on_iff_parked;
alter table public.freezes add constraint freezes_waiting_on_iff_parked
  check ((outcome is not distinct from 'parked') = (waiting_on is not null));

-- ---------------------------------------------------------------------------
-- Freeze <-> card links. Replaces cards.freeze_id, which could only say "this
-- card came from that freeze" — it cannot express `existing_card`, where one
-- card already in the deck covers several freezes. cards.freeze_id stays in
-- the schema and is no longer read or written.
-- ---------------------------------------------------------------------------
create table if not exists public.freeze_cards (
  freeze_id uuid not null references public.freezes (id) on delete cascade,
  card_id   uuid not null references public.cards (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (freeze_id, card_id)
);

create index if not exists freeze_cards_card_idx on public.freeze_cards (card_id);

alter table public.freeze_cards enable row level security;

drop policy if exists freeze_cards_owner on public.freeze_cards;
create policy freeze_cards_owner on public.freeze_cards
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.freeze_cards (freeze_id, card_id, user_id)
select c.freeze_id, c.id, c.user_id
from public.cards c
where c.freeze_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- `resolved` becomes derived from outcome, so a freeze can never be resolved
-- with nothing behind it.
--
-- Backfill first. Leaving outcome null on every existing row (as a clean
-- migration would) would put every already-carded and already-discarded freeze
-- back in the untriaged queue, because resolved is about to be computed from
-- outcome. Only rows still holding the stored column are touched, so a re-run
-- is a no-op.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freezes'
      and column_name = 'resolved' and is_generated = 'NEVER'
  ) then
    update public.freezes f
    set outcome = case
          when exists (select 1 from public.freeze_cards fc where fc.freeze_id = f.id)
            then 'carded'
          else 'discarded'
        end
    where f.resolved and f.outcome is null;

    -- The untriaged index depends on the column; it is recreated below.
    alter table public.freezes drop column resolved;
    alter table public.freezes add column resolved boolean
      generated always as (outcome is not null and outcome <> 'parked') stored;
  end if;
end $$;

drop index if exists public.freezes_untriaged_idx;
create index if not exists freezes_untriaged_idx
  on public.freezes (user_id, captured_at)
  where outcome is null;

create or replace function public.count_untriaged_freezes()
returns int
language sql
stable
as $$
  select count(*)::int
  from public.freezes
  where user_id = auth.uid()
    and outcome is null;
$$;

-- ---------------------------------------------------------------------------
-- Cards. `roman` / `gurmukhi` / `agreement_slot` are now the form to PRODUCE —
-- the family form wherever the family has confirmed one. `family_variant` is
-- another form the family also accepts; `standard_roman` is the textbook form
-- they do not use. Neither is graded against.
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists standard_roman text,
  add column if not exists batch_id text;

-- ---------------------------------------------------------------------------
-- Applied batches. The primary key is what makes a batch id single-use.
-- ---------------------------------------------------------------------------
create table if not exists public.imports (
  user_id         uuid not null references auth.users (id) on delete cascade,
  batch_id        text not null,
  summary         text not null,
  -- When Claude wrote the file, as opposed to when it was applied.
  created_at      timestamptz,
  applied_at      timestamptz not null default now(),
  cards_added     integer not null,
  cards_updated   integer not null,
  freezes_updated integer not null,
  primary key (user_id, batch_id)
);

alter table public.imports enable row level security;

-- Like review_events, a record rather than state: read and insert only.
drop policy if exists imports_read on public.imports;
drop policy if exists imports_append on public.imports;
create policy imports_read on public.imports
  for select to authenticated using (user_id = auth.uid());
create policy imports_append on public.imports
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Apply a session import atomically: everything lands or nothing does.
--
-- Takes the PLAN the server built after validating the file — slot indices
-- already derived, keys already snake_case. Validation lives in TypeScript so
-- the preview can list every problem at once; this function relies on
-- constraints and row counts only to guarantee that nothing half-applies if
-- the data moved between preview and apply.
--
-- security invoker: RLS still applies to every statement.
-- ---------------------------------------------------------------------------
create or replace function public.apply_session_import(p_plan jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_deck uuid := (p_plan->>'deck_id')::uuid;
  u      jsonb;
  s      jsonb;
  f      jsonb;
  n      int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- First, so a reused batch id fails before anything else is written.
  insert into public.imports
    (user_id, batch_id, summary, created_at, cards_added, cards_updated, freezes_updated)
  values (
    v_user,
    p_plan->>'batch_id',
    p_plan->>'summary',
    (p_plan->>'created_at')::timestamptz,
    jsonb_array_length(p_plan->'cards_add'),
    jsonb_array_length(p_plan->'cards_update'),
    jsonb_array_length(p_plan->'freezes_update')
  );

  insert into public.cards (
    id, deck_id, user_id, english, gurmukhi, roman, frame_tag, agreement_slot,
    slot_index_roman, slot_index_gurmukhi, notes, family_variant,
    standard_roman, verified, active, batch_id
  )
  select
    (c->>'id')::uuid, v_deck, v_user, c->>'english', c->>'gurmukhi',
    c->>'roman', c->>'frame_tag', c->>'agreement_slot',
    (c->>'slot_index_roman')::int, (c->>'slot_index_gurmukhi')::int,
    c->>'notes', c->>'family_variant', c->>'standard_roman',
    coalesce((c->>'verified')::boolean, false), true, p_plan->>'batch_id'
  from jsonb_array_elements(p_plan->'cards_add') c;

  for u in select * from jsonb_array_elements(p_plan->'cards_update') loop
    s := u->'set';
    update public.cards set
      english             = case when s ? 'english' then s->>'english' else english end,
      gurmukhi            = case when s ? 'gurmukhi' then s->>'gurmukhi' else gurmukhi end,
      roman               = case when s ? 'roman' then s->>'roman' else roman end,
      frame_tag           = case when s ? 'frame_tag' then s->>'frame_tag' else frame_tag end,
      agreement_slot      = case when s ? 'agreement_slot' then s->>'agreement_slot' else agreement_slot end,
      slot_index_roman    = case when s ? 'slot_index_roman' then (s->>'slot_index_roman')::int else slot_index_roman end,
      slot_index_gurmukhi = case when s ? 'slot_index_gurmukhi' then (s->>'slot_index_gurmukhi')::int else slot_index_gurmukhi end,
      notes               = case when s ? 'notes' then s->>'notes' else notes end,
      family_variant      = case when s ? 'family_variant' then s->>'family_variant' else family_variant end,
      standard_roman      = case when s ? 'standard_roman' then s->>'standard_roman' else standard_roman end,
      verified            = case when s ? 'verified' then (s->>'verified')::boolean else verified end,
      active              = case when s ? 'active' then (s->>'active')::boolean else active end,
      batch_id            = p_plan->>'batch_id'
    where id = (u->>'id')::uuid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Card % not found', u->>'id';
    end if;

    -- The expected answer changed, so earlier grades were given against a
    -- different sentence. Scheduling restarts; review_events keeps the history.
    if (u->>'reset_review')::boolean then
      update public.card_review_state
      set box = 1, due_at = now(), lapses = 0, agreement_fails = 0
      where card_id = (u->>'id')::uuid;
    end if;
  end loop;

  for f in select * from jsonb_array_elements(p_plan->'freezes_update') loop
    update public.freezes set
      bucket     = f->>'bucket',
      outcome    = f->>'outcome',
      waiting_on = f->>'waiting_on',
      note       = f->>'note',
      triaged_at = now(),
      batch_id   = p_plan->>'batch_id'
    where id = (f->>'id')::uuid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Freeze % not found', f->>'id';
    end if;

    -- The file states the full set of links, so replace rather than merge.
    delete from public.freeze_cards where freeze_id = (f->>'id')::uuid;
    insert into public.freeze_cards (freeze_id, card_id, user_id)
    select (f->>'id')::uuid, x::uuid, v_user
    from jsonb_array_elements_text(f->'card_ids') x;
  end loop;
end;
$$;
