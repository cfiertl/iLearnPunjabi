-- 0005_script_mode.sql
-- Which script leads on a card, and which one cloze blanks.
--
-- The build spec made Gurmukhi the primary display, but reading it is itself
-- scheduled over the first six weeks. Until that lands, Gurmukhi is decoration
-- the reader cannot use — and worse, the cloze front was blanking a token in a
-- script they cannot yet parse, which makes the exercise impossible rather than
-- merely harder.
--
-- Defaults to roman_primary. Flip to gurmukhi_primary once the script is
-- readable; nothing else about scheduling or grading changes.
--
-- Idempotent: safe to re-run.

alter table public.user_settings
  add column if not exists script_mode text not null default 'roman_primary';

alter table public.user_settings
  drop constraint if exists user_settings_script_mode_check;

alter table public.user_settings
  add constraint user_settings_script_mode_check
  check (script_mode in ('roman_primary', 'gurmukhi_primary'));
