-- 0013_shared_daily_budget.sql
-- Two fixes to card delivery, and a smaller day.
--
-- 1. THE BUDGET IS NOW ONE BUDGET, SHARED BY BOTH MODES.
--
--    0012 made session_cap a budget for the day rather than for each visit, but
--    `my_remaining_today` subtracted only the reviews done in ONE mode. So a cap
--    of 30 handed out 30 production cards AND 30 cloze cards: sixty sentence
--    reviews, from a setting the UI calls "Reviews per day". The label promised
--    a day; the SQL enforced a day per mode. A day's work is a day's work
--    whichever mode it was spent in, so the cap now counts both together.
--
--    Counted as distinct (card_id, mode) pairs: one card reviewed in production
--    and again in cloze is two pieces of work, and should cost two slots. A card
--    re-graded in the same mode still costs one.
--
-- 2. NEW CARDS NOW HOLD A RESERVED SLOT INSTEAD OF BEING SILENTLY CUT.
--
--    New cards enter the queue with `due_at = now()`, which is LATER than every
--    overdue review, and the queue is ordered `due_at asc` before the cap chops
--    the tail. So whenever the due backlog reached the cap -- the normal state
--    of a deck that is behind -- the new cards were exactly what got cut, every
--    day, without a word. The deck silently stopped growing.
--
--    Now new_per_day is a RESERVATION taken off the top of the budget, not what
--    is left over after reviews. The remainder goes to due cards. New cards are
--    also ordered first: a slot reserved and then left at the tail of a sitting
--    that gets ended early is not reserved at all.
--
-- 3. FEWER CARDS.
--
--    30/day (in practice 60, see 1) is more than this deck can justify, and
--    new_per_day = 10 does not survive contact with the box-5 interval. A card
--    that reaches box 5 stays there on a 16-day cycle for good, so each new card
--    adds ~1/16 of a review per day PERMANENTLY. Ten new cards a day per mode
--    grows the steady-state load by ~1.25 reviews/day every single day -- it
--    outruns any fixed cap, which is what produced the starvation in 2.
--    15 reviews and 3 new cards a day is a load the intervals can actually
--    carry. Both remain settings; only the numbers change.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Defaults, and the owner's stored values.
--
-- The column defaults only bite on a row that does not exist yet, and this app
-- has exactly one user whose row was written long ago. Update it too, but only
-- where it still holds the OLD DEFAULT: a value that has been moved off 30/10
-- in Settings was chosen, and a migration has no business overwriting it.
-- (A value deliberately set back to 30 is indistinguishable from an untouched
-- one and will be moved. Re-enter it in Settings if that is what you meant.)
-- ---------------------------------------------------------------------------
alter table public.user_settings
  alter column session_cap set default 15,
  alter column new_per_day set default 3;

update public.user_settings set session_cap = 15 where session_cap = 30;
update public.user_settings set new_per_day = 3  where new_per_day = 10;

-- ---------------------------------------------------------------------------
-- Today's spend, across both modes, and what is left of the shared budget.
--
-- Still read from review_events, the append-only record, rather than from
-- card_review_state.last_reviewed_at: a state row holds only the latest review,
-- so a card graded and then re-graded would erase the earlier one from the
-- tally.
--
-- `my_reviews_today(p_mode)` from 0012 is left in place, unchanged and unused
-- by the app, as the per-mode counterpart for ad-hoc queries. Nothing that
-- counts against the cap may use it any more: the screens all moved to the
-- shared count, because a per-mode number counted against a shared budget is
-- exactly the mismatch this migration exists to remove.
-- ---------------------------------------------------------------------------
create or replace function public.my_reviews_today_all()
returns int
language sql
stable
as $$
  select count(*)::int
  from (
    select distinct e.card_id, e.mode
    from public.review_events e
    where e.user_id = auth.uid()
      and e.reviewed_at >= public.my_day_start()
  ) spent;
$$;

-- Loses its parameter: the budget no longer depends on which mode is asking.
-- Both signatures are dropped so a re-run cannot leave the one-argument version
-- behind for a stale caller to resolve against.
drop function if exists public.count_due_reviews(text, boolean);
drop function if exists public.get_study_session(text, boolean);
drop function if exists public.my_remaining_today(text);
drop function if exists public.my_remaining_today();

create function public.my_remaining_today()
returns int
language sql
stable
as $$
  select greatest(public.my_session_cap() - public.my_reviews_today_all(), 0);
$$;

-- ---------------------------------------------------------------------------
-- How today's budget is divided. One definition, used by both the count and the
-- queue, so the home screen can never advertise a number the session will not
-- serve.
--
--   new_take = the reservation: what is left of new_per_day, what new cards
--              actually exist, and what the budget can hold -- whichever is
--              smallest.
--   due_take = the rest of the budget.
--
-- `p_ignore_daily_cap` is the `?all=1` door: a second helping once the day's set
-- is finished. It spends a fresh full cap and keeps the same split.
-- ---------------------------------------------------------------------------
create or replace function public.my_day_split(
  p_mode             text,
  p_ignore_daily_cap boolean default false
)
returns table (budget int, new_take int, due_take int)
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
  -- Internal names are deliberately NOT budget/new_take/due_take: those are the
  -- RETURNS TABLE output names, and leaving them unshadowed keeps the final
  -- select unambiguous.
  n as (
    select
      (case when p_ignore_daily_cap
            then public.my_session_cap()
            else public.my_remaining_today() end)            as cap_left,
      (select count(*)::int from eligible e where e.is_new)  as fresh_available,
      (select count(*)::int from eligible e
         where not e.is_new and e.due_at <= now())           as due_available,
      greatest(public.my_new_per_day() - (
        select count(*)::int
        from public.card_review_state s
        where s.user_id = auth.uid()
          and s.mode = p_mode
          and s.created_at >= public.my_day_start()), 0)     as new_allowance
  ),
  reserved as (
    select n.cap_left,
           n.due_available,
           least(n.new_allowance, n.fresh_available, n.cap_left) as reserve
    from n
  )
  select r.cap_left,
         r.reserve,
         least(r.due_available, greatest(r.cap_left - r.reserve, 0))
  from reserved r;
$$;

-- ---------------------------------------------------------------------------
-- Due count. Uncapped it is the real backlog, which is what "and there is still
-- this much waiting" has to report -- capping that number would understate it
-- and call it fact.
-- ---------------------------------------------------------------------------
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
  uncapped as (
    select (select count(*)::int from eligible e
              where not e.is_new and e.due_at <= now())
         + least(
             (select count(*)::int from eligible e where e.is_new),
             greatest(public.my_new_per_day() - (
               select count(*)::int
               from public.card_review_state s
               where s.user_id = auth.uid()
                 and s.mode = p_mode
                 and s.created_at >= public.my_day_start()), 0)
           ) as n
  )
  select case
           when p_ignore_daily_cap then (select u.n from uncapped u)
           -- Exactly what the queue below will hand over.
           else (select d.new_take + d.due_take
                 from public.my_day_split(p_mode, false) d)
         end;
$$;

-- ---------------------------------------------------------------------------
-- The session queue.
--
-- Two separately limited halves rather than one union chopped at the end: that
-- final chop is what was eating the new cards. New first, then due by how long
-- they have been waiting.
-- ---------------------------------------------------------------------------
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
  with split as (
    select * from public.my_day_split(p_mode, p_ignore_daily_cap)
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
  fresh as (
    select e.id, e.due_at, e.box
    from eligible e
    where e.is_new
    order by e.created_at
    limit (select s.new_take from split s)
  ),
  due as (
    select e.id, e.due_at, e.box
    from eligible e
    where not e.is_new and e.due_at <= now()
    order by e.due_at asc, e.box asc
    limit (select s.due_take from split s)
  ),
  q as (
    select f.id, f.due_at, f.box, 0 as slot_rank from fresh f
    union all
    select d.id, d.due_at, d.box, 1 as slot_rank from due d
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
  order by q.slot_rank asc, q.due_at asc, q.box asc;
$$;
