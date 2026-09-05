# Archived by the buildplan.md conversion

These files were removed from the app when it was converted from a vocabulary
trainer into a sentence production trainer. Nothing here is referenced any more.

This project is not under version control, so the files were moved rather than
deleted. Delete this directory once you are happy with the conversion.

- `src/app/(app)/tutor/`   — Claude AI tutor chat (Phase 2)
- `src/components/tutor-chat.tsx`
- `src/components/budget-bar.tsx`
- `src/components/import-deck-button.tsx` — replaced by `card-manager.tsx`
- `src/lib/anthropic.ts`
- `src/lib/pricing.ts`
- `src/lib/usage/`         — AI spend tracking
- `src/lib/fsrs.ts`        — replaced by `src/lib/leitner.ts`
- `src/content/starter-deck.ts` — 73 word-level vocab cards; the build spec
  rules out word-level cards, but the curated list is kept here in case the
  sentences are ever built from it.

The matching database tables (`review_state`, `review_logs`, `daily_activity`,
`usage_events`) were deliberately NOT dropped — see
`supabase/migrations/0003_sentence_trainer.sql`.
