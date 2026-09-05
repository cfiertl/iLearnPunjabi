-- 0004_page_rpcs.sql
-- Cuts the number of SERIAL Supabase round trips per page load.
--
-- Each round trip costs a full client -> edge -> database hop, so pages that
-- awaited prefs before they could even ask for data were paying that twice.
-- These functions read the session preferences themselves, which lets the app
-- fire every query for a page concurrently instead of in a chain.
--
-- Idempotent: safe to re-run. Purely additive -- the 0003 functions still exist.

-- ---------------------------------------------------------------------------
-- Effective preferences, falling back to defaults when no settings row exists.
-- ---------------------------------------------------------------------------
create or replace function public.my_new_per_day()
returns int
language sql
stable
as $$
  select coalesce(
    (select s.new_per_day from public.user_settings s where s.user_id = auth.uid()),
    10);
$$;

create or replace function public.my_session_cap()
returns int
language sql
stable
as $$
  select coalesce(
    (select s.session_cap from public.user_settings s where s.user_id = auth.uid()),
    30);
$$;

-- ---------------------------------------------------------------------------
-- Due count for a mode.
--
-- Replaces count_review_queue, which built the entire queue via
-- get_review_queue(mode, 1000000, ...) purely to count the rows. This counts
-- directly and applies the same daily new-card throttle.
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
      and s.created_at >= date_trunc('day', now())
  )
  select (select count(*)::int from eligible e
           where not e.is_new and e.due_at <= now())
       + least(
           (select count(*)::int from eligible e where e.is_new),
           greatest(public.my_new_per_day() - (select i.n from introduced i), 0)
         );
$$;

-- ---------------------------------------------------------------------------
-- One call for a whole study session: the due queue, each card's box, and any
-- attached audio clip -- previously an RPC followed by two more queries that
-- could not start until the queue came back.
--
-- Reads session_cap and new_per_day itself, so the app no longer has to fetch
-- preferences before it can ask for cards.
--
-- Every column reference below is table-qualified on purpose: RETURNS TABLE
-- output names are also parameters in a SQL function, so a bare `box` or
-- `notes` would be ambiguous against the real columns.
-- ---------------------------------------------------------------------------
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
