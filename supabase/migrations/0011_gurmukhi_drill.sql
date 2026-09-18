-- 0011_gurmukhi_drill.sql
-- Gurmukhi recognition drill: a two-minute daily read-aloud-then-pick drill,
-- fully separate from the Leitner deck. Nothing here touches cards,
-- card_review_state or review_events.
--
-- Item content (letters, vowel marks, confusable sets, words) is seeded per
-- user by the app on first use, then changed only through the session import.
-- Attempts are an append-only diagnostic record, like review_events.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Letters. History is keyed on the Gurmukhi, never the label, so a label
-- change (e.g. once the family confirms tone vs aspiration) keeps all history.
-- ---------------------------------------------------------------------------
create table if not exists public.gurmukhi_letters (
  user_id              uuid not null references auth.users (id) on delete cascade,
  char                 text not null,
  label                text not null,
  grid_row             smallint not null,
  grid_col             smallint not null,
  rare                 boolean not null default false,
  pending_family_check boolean not null default false,
  -- One way: the import can unlock, never lock.
  unlocked             boolean not null default false,
  primary key (user_id, char)
);

create table if not exists public.gurmukhi_marks (
  user_id  uuid not null references auth.users (id) on delete cascade,
  mark     text not null,
  label    text not null,
  sort     smallint not null default 0,
  unlocked boolean not null default false,
  primary key (user_id, mark)
);

create table if not exists public.gurmukhi_sets (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  kind        text not null,
  chars       text[] not null,
  description text not null,
  primary key (user_id, id)
);

-- Words are authored with explicit options: never transliterated or generated.
-- source_card_id is a plain reference for the record, deliberately not a
-- foreign key — a word item must never be coupled to the Leitner deck.
create table if not exists public.gurmukhi_words (
  user_id        uuid not null references auth.users (id) on delete cascade,
  id             text not null,
  gurmukhi       text not null,
  reading        text not null,
  options        text[] not null,
  source_card_id text,
  added_week     integer,
  batch_id       text,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Attempts. The id is generated in the browser, so an attempt queued offline
-- and uploaded twice lands once.
-- ---------------------------------------------------------------------------
create table if not exists public.gurmukhi_attempts (
  id             uuid primary key,
  -- Defaulted so the browser can upload a queued attempt without first
  -- asking the network who it is.
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id     uuid not null,
  attempted_at   timestamptz not null,
  item_id        text not null,
  item_type      text not null check (item_type in ('letter', 'syllable', 'word')),
  shown          text not null,
  correct_label  text not null,
  picked_label   text not null,
  -- Letter items only, per the spec.
  picked_char    text,
  -- The Gurmukhi of the picked option for letters and syllables (null for
  -- words), so a syllable pick can be read back as a consonant confusion.
  picked_shown   text,
  correct        boolean not null,
  recognition_ms integer not null check (recognition_ms >= 0),
  pick_ms        integer not null check (pick_ms >= 0),
  uploaded_at    timestamptz not null default now()
);

create index if not exists gurmukhi_attempts_user_time_idx
  on public.gurmukhi_attempts (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.gurmukhi_letters  enable row level security;
alter table public.gurmukhi_marks    enable row level security;
alter table public.gurmukhi_sets     enable row level security;
alter table public.gurmukhi_words    enable row level security;
alter table public.gurmukhi_attempts enable row level security;

drop policy if exists gurmukhi_letters_owner on public.gurmukhi_letters;
create policy gurmukhi_letters_owner on public.gurmukhi_letters
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gurmukhi_marks_owner on public.gurmukhi_marks;
create policy gurmukhi_marks_owner on public.gurmukhi_marks
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gurmukhi_sets_owner on public.gurmukhi_sets;
create policy gurmukhi_sets_owner on public.gurmukhi_sets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gurmukhi_words_owner on public.gurmukhi_words;
create policy gurmukhi_words_owner on public.gurmukhi_words
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A record rather than state: read and insert only.
drop policy if exists gurmukhi_attempts_read on public.gurmukhi_attempts;
drop policy if exists gurmukhi_attempts_append on public.gurmukhi_attempts;
create policy gurmukhi_attempts_read on public.gurmukhi_attempts
  for select to authenticated using (user_id = auth.uid());
create policy gurmukhi_attempts_append on public.gurmukhi_attempts
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Settings: the "Palm check" hint during the Say stage. On by default.
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists gurmukhi_palm_hint boolean not null default true;

-- ---------------------------------------------------------------------------
-- Imports record how many Gurmukhi changes a batch carried.
-- ---------------------------------------------------------------------------
alter table public.imports
  add column if not exists gurmukhi_changes integer not null default 0;

-- ---------------------------------------------------------------------------
-- apply_session_import gains an optional `gurmukhi` section. Without it the
-- function does exactly what 0009 did. Same signature, so replace in place.
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
  g      jsonb := p_plan->'gurmukhi';
  n      int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- First, so a reused batch id fails before anything else is written.
  insert into public.imports
    (user_id, batch_id, summary, created_at, cards_added, cards_updated,
     freezes_updated, gurmukhi_changes)
  values (
    v_user,
    p_plan->>'batch_id',
    p_plan->>'summary',
    (p_plan->>'created_at')::timestamptz,
    jsonb_array_length(p_plan->'cards_add'),
    jsonb_array_length(p_plan->'cards_update'),
    jsonb_array_length(p_plan->'freezes_update'),
    coalesce((p_plan->>'gurmukhi_changes')::int, 0)
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

    delete from public.freeze_cards where freeze_id = (f->>'id')::uuid;
    insert into public.freeze_cards (freeze_id, card_id, user_id)
    select (f->>'id')::uuid, x::uuid, v_user
    from jsonb_array_elements_text(f->'card_ids') x;
  end loop;

  -- --- Gurmukhi ------------------------------------------------------------
  -- The plan is complete and validated; order matters only in that letters
  -- must exist before they are relabelled or unlocked.
  if g is null or jsonb_typeof(g) <> 'object' then
    return;
  end if;

  -- New letters arrive locked; an existing letter keeps its unlock state.
  insert into public.gurmukhi_letters
    (user_id, char, label, grid_row, grid_col, rare, pending_family_check, unlocked)
  select v_user, x->>'char', x->>'label', (x->>'row')::smallint,
         (x->>'col')::smallint, (x->>'rare')::boolean,
         (x->>'pending_family_check')::boolean, false
  from jsonb_array_elements(g->'letters_upsert') x
  on conflict (user_id, char) do update set
    label                = excluded.label,
    grid_row             = excluded.grid_row,
    grid_col             = excluded.grid_col,
    rare                 = excluded.rare,
    pending_family_check = excluded.pending_family_check;

  for u in select * from jsonb_array_elements(g->'letter_labels') loop
    update public.gurmukhi_letters set
      label = case when u ? 'label' then u->>'label' else label end,
      pending_family_check = case when u ? 'pending_family_check'
        then (u->>'pending_family_check')::boolean else pending_family_check end
    where user_id = v_user and char = u->>'char';
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Gurmukhi letter % not found', u->>'char';
    end if;
  end loop;

  for u in select * from jsonb_array_elements(g->'mark_labels') loop
    update public.gurmukhi_marks set label = u->>'label'
    where user_id = v_user and mark = u->>'mark';
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Gurmukhi mark % not found', u->>'mark';
    end if;
  end loop;

  update public.gurmukhi_letters set unlocked = true
  where user_id = v_user
    and char in (select jsonb_array_elements_text(g->'unlock_letters'));

  update public.gurmukhi_marks set unlocked = true
  where user_id = v_user
    and mark in (select jsonb_array_elements_text(g->'unlock_marks'));

  insert into public.gurmukhi_sets (user_id, id, kind, chars, description)
  select v_user, x->>'id', x->>'kind',
         array(select jsonb_array_elements_text(x->'chars')), x->>'description'
  from jsonb_array_elements(g->'sets_upsert') x
  on conflict (user_id, id) do update set
    kind        = excluded.kind,
    chars       = excluded.chars,
    description = excluded.description;

  insert into public.gurmukhi_words
    (user_id, id, gurmukhi, reading, options, source_card_id, added_week, batch_id)
  select v_user, x->>'id', x->>'gurmukhi', x->>'reading',
         array(select jsonb_array_elements_text(x->'options')),
         x->>'source_card_id', (x->>'added_week')::int, p_plan->>'batch_id'
  from jsonb_array_elements(g->'words_upsert') x
  on conflict (user_id, id) do update set
    gurmukhi       = excluded.gurmukhi,
    reading        = excluded.reading,
    options        = excluded.options,
    source_card_id = excluded.source_card_id,
    added_week     = excluded.added_week,
    batch_id       = excluded.batch_id;
end;
$$;
