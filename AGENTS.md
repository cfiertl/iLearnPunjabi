# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# ILearnPunjabi — project rules

Personal Punjabi **sentence production trainer** (Next.js 16 + Supabase +
Vercel). The authoritative brief is `buildplan.md`; `SETUP.md` covers setup and
deploy.

**Hard product constraints:**
- **Not a vocabulary trainer.** Vocabulary is not the bottleneck — grammatical
  agreement is. Cards are **sentences, never single words**.
- **The three-grade scale is the point.** `correct` / `agreement` / `fail`,
  where `agreement` means "right words, wrong agreement". `agreement` and
  `fail` schedule identically and differ only in what they record. Never merge
  them, and never add a four- or five-point scale.
- **Everything is spoken aloud before flipping.** The flip button holds for a
  beat by default so checking cannot replace attempting.
- **Gurmukhi IS shown, and is the primary display on card backs.** (This
  reverses the earlier romanized-only rule: romanisation cannot represent
  aspiration or tone, and script recognition is trained in parallel.)
  Romanisation is the secondary line.
- Dialect = **Eastern (Indian) Punjabi**, also covering the Malaysian/Singaporean
  Sikh diaspora.
- No accounts beyond the single owner, no sync, no sharing, no gamification,
  no streaks, no leaderboards, no multiple-choice, no typing-the-answer.

**Conventions:**
- Supabase via `@supabase/ssr`: `src/lib/supabase/{client,server,middleware}.ts`.
  Everything is guarded by `isSupabaseConfigured` so the app runs before setup.
- Authenticated pages live under the `src/app/(app)/` route group.
- Auth gating + Supabase session refresh live in **`src/proxy.ts`** (Next 16
  renamed the `middleware` convention to `proxy`). It MUST be inside `src/`
  when a `src/` dir is used, or Next silently ignores it.
- Scheduling is **Leitner**, five boxes, 1/2/4/8/16 days (`src/lib/leitner.ts`).
  Deliberately not FSRS/SM-2 — do not "upgrade" it.
- `public.review_events` is **append-only**: never mutated, never pruned. It is
  the diagnostic record the whole app exists to produce. RLS grants select and
  insert only.
- One `card_review_state` row per **(card, mode)** pair — a card carries two
  independent schedules, `production` and `cloze`.

**Status:** build-plan steps 1-7 complete — data layer, JSON import + seed
batch, production review loop with three-grade grading, Leitner scheduling and
the due queue, export, cloze mode, and the statistics view. The reference
addendum (`/reference`) is built.

**Only step 8 remains: audio capture** (MediaRecorder + speaker tagging). The
`audio_clips` table and the `card-audio` bucket already exist, and the review UI
already renders a play button when a card has a clip attached.

`src/lib/frame-tags.ts` is the SINGLE SOURCE OF TRUTH for agreement rules:
`short` for card backs, `long` with a worked example for the reference. Never
add a second copy of these rules anywhere.

The reference section is static text authored as components, not markdown, and
drives no app behaviour. Its only functional coupling is the cloze card back
linking a `frameTag` to `/reference/frames#<tag>`. Search builds its index by
walking the rendered tree (`sectionText`), so table content must live in
`children` rather than props to stay searchable.

Legacy Phase-0/1 tables (`review_state`, `review_logs`, `daily_activity`,
`usage_events`) still exist but are no longer read; superseded source files are
parked in `.archive/`.
