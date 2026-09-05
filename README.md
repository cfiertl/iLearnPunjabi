# ILearnPunjabi

A personal Punjabi **sentence production trainer**, instrumented on grammatical
agreement. Single learner, English L1.

Vocabulary is not the bottleneck — agreement is. So this is not a vocabulary
trainer: cards are whole sentences, and the grading scale has a dedicated third
state for *"right words, wrong agreement"*. That signal is the point of the app.

## How a review works

The front shows an English prompt and nothing else. You say the full sentence
aloud; the Flip button deliberately holds for a beat so checking cannot replace
attempting. The back leads with Gurmukhi, romanisation beneath.

| Key | Grade | Effect |
| --- | --- | --- |
| 1 | Got it | box + 1 (max 5) |
| 2 | Right words, wrong agreement | box 1, due tomorrow, logged as an agreement fail |
| 3 | Couldn't produce it | box 1, due tomorrow, logged as a lapse |

Grades 2 and 3 schedule **identically** — they differ only in what they record.
Scheduling is Leitner, five boxes, 1/2/4/8/16 days. `review_events` is
append-only: it is the diagnostic record the app exists to produce.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres, Auth,
Storage) · PWA. See [SETUP.md](SETUP.md) to run it, [AGENTS.md](AGENTS.md) for
the project rules, and `buildplan.md` for the authoritative brief.

## Status

Build-spec steps 1–5 are done: data layer, JSON import + seed batch, production
review loop, Leitner scheduling, export.

Not built yet — cloze mode, the statistics view, and audio capture. These are
gated on confirming the core loop feels right with real cards first. The schema
already supports all three.
