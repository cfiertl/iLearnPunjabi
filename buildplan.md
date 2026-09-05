# Punjabi SRS — Build Spec

Implementation brief for an existing PWA (Netlify-hosted). Adapt to the current stack rather than rewriting; this describes behaviour and data, not framework choices.

---

## Purpose and constraints

Single user, one learner, English L1, learning Punjabi. Vocabulary is **not** the bottleneck — the learner has a large passive vocabulary. The bottleneck is **grammatical agreement** and a handful of missing verb forms.

This means the app is not a vocabulary trainer. It is a **sentence production trainer** with instrumentation on one specific failure mode.

Three design consequences that should not be optimised away:

1. Cards are sentences, never single words.
2. The grading scale has a dedicated third state for "right words, wrong agreement." This is the whole point of the app.
3. Everything is spoken aloud before flipping. The UI should make skipping that feel wrong.

Offline-capable, installable, no login, no backend beyond static hosting. All state in IndexedDB.

---

## Data model

### Card

```ts
type Card = {
  id: string; // uuid
  englishPrompt: string; // "I ate roti yesterday"
  gurmukhi: string; // "ਮੈਂ ਕੱਲ੍ਹ ਰੋਟੀ ਖਾਧੀ"
  roman: string; // "Main kal roti khadhi"
  frameTag: string; // "perfective_object_agreement"
  agreementSlot: string | null; // "khadhi" — the token under test
  slotIndexRoman: number | null; // token index in `roman` for cloze rendering
  slotIndexGurmukhi: number | null;
  audioId: string | null; // FK to AudioClip
  notes: string | null; // register/usage note shown on the back
  createdAt: number;
  active: boolean; // soft delete
};
```

### AudioClip

```ts
type AudioClip = {
  id: string;
  blob: Blob; // stored in IndexedDB, not the filesystem
  speaker: string; // "Jasmine", "MIL", "self"
  recordedAt: number;
  durationMs: number;
};
```

### ReviewState

One row per (card, mode) pair. A single card yields two independent review schedules.

```ts
type ReviewState = {
  cardId: string;
  mode: "production" | "cloze";
  box: 1 | 2 | 3 | 4 | 5;
  dueAt: number; // epoch ms, midnight-aligned
  lapses: number;
  agreementFails: number; // count of grade === "agreement"
  lastGrade: Grade | null;
  lastReviewedAt: number | null;
};
```

### ReviewEvent

Append-only. Never mutate or prune — this is the diagnostic record.

```ts
type ReviewEvent = {
  id: string;
  cardId: string;
  mode: "production" | "cloze";
  grade: "correct" | "agreement" | "fail";
  frameTag: string; // denormalised for cheap aggregation
  reviewedAt: number;
  boxBefore: number;
  boxAfter: number;
};
```

---

## Scheduling

Leitner, five boxes. Intervals in days: **1, 2, 4, 8, 16**.

Grade transitions:

| Grade       | Effect                                      |
| ----------- | ------------------------------------------- |
| `correct`   | box + 1 (max 5), due in that box's interval |
| `agreement` | box → 1, due tomorrow, `agreementFails` + 1 |
| `fail`      | box → 1, due tomorrow, `lapses` + 1         |

`agreement` and `fail` are scheduled identically on purpose. They differ only in what they record. Do not let anyone "simplify" them into one grade.

Due queue: all states where `dueAt <= now`, ordered by `dueAt` ascending, then by `box` ascending so struggling cards surface first. Cap a session at 30 reviews by default, user-adjustable.

New cards enter at box 1 due immediately, throttled to 10 new per day.

---

## Review UI

Two modes, both driven by the same card data.

### Production mode

**Front:** the English prompt. Nothing else. No hint, no first letter, no audio.

Below it, a prominent instruction: _Say the full sentence aloud, then flip._

There should be a deliberate friction beat before the flip is available — a ~1.5s delay before the Flip button enables, or a press-and-hold. The purpose is to prevent the reflex of flipping to "check" before actually attempting production. Make this configurable but on by default.

**Back:** Gurmukhi large and primary, romanisation smaller beneath it, notes below that, and an audio play button if a clip is attached.

The Gurmukhi is the primary display, not a secondary annotation. The learner is training script recognition in parallel and romanisation cannot represent aspiration or tone. Type size should reflect that hierarchy.

### Cloze mode

Only generated for cards where `agreementSlot` is non-null.

**Front:** the Gurmukhi sentence with the agreement slot replaced by a visible blank, English prompt shown small underneath for context.

**Back:** the full sentence with the slot highlighted, plus the `frameTag` rendered as a human-readable rule reminder (a lookup table of tag → one-line explanation, see below).

---

## Grading controls

Three buttons, always in this order, always with these labels:

1. **Got it**
2. **Right words, wrong agreement**
3. **Couldn't produce it**

Button 2 must be visually equal in weight to the others. It is the primary signal being collected, and if it is styled as a secondary or "partial credit" option it will be under-reported.

Keyboard shortcuts 1/2/3. Do not add a four-point or five-point scale.

---

## Statistics view

The point of this screen is answering one question: **is the agreement problem shrinking?**

- **Agreement-fail rate over time.** `agreement` events as a share of all events, bucketed weekly, as a line chart. This is the headline number and belongs at the top.
- **Breakdown by `frameTag`.** Table: frame, total reviews, agreement-fail rate, trend arrow. Sorted worst-first. This identifies which specific structure is unresolved.
- **Leech list.** Cards with `agreementFails >= 4`. These need re-teaching rather than re-drilling.
- Box distribution and due-forecast for the next 7 days. Secondary, keep small.

---

## Import and export

**Import:** paste or upload a JSON array of card objects (schema above, minus `id`/`createdAt`/`active`, which are generated). Validate, show a preview count, warn on `frameTag` values not in the known list rather than rejecting them. Idempotent on `englishPrompt` + `gurmukhi` — re-importing the same batch should not duplicate.

**Export:** single button producing a JSON file containing all cards, all ReviewState, and all ReviewEvent. This gets pasted into a tutoring conversation for analysis, so keep it human-readable — pretty-printed, no binary. Exclude audio blobs from this export; offer a separate audio export if needed.

---

## Audio capture

In-app recording via MediaRecorder, attachable to any card. Record, preview, save, re-record. Store the blob in IndexedDB keyed by `AudioClip.id`.

Playback on the card back only, never on the front — hearing it before attempting production defeats the exercise.

Tag each clip with a speaker name. Family recordings are the highest-value asset in the system and the speaker attribution matters later.

---

## Frame tag reference

Seed this lookup so cloze backs can show the rule:

```
dative_subject          → Experiencer takes -nu; verb agrees with the experience, not you
copula_agreement        → hai/haan/ho follows the grammatical subject
genitive_da_di_de       → Agrees with the thing possessed, not the possessor
perfective_object_agr   → Past transitive verb agrees with the object
future_anga_angi        → -anga (m) / -angi (f) on the stem
polite_imperative       → tusi form, + ji for elders
negation_placement      → nahi goes before the verb
continuous_agreement    → riha/rahi/rahe matches subject gender and number
```

---

## Non-goals

Do not build: accounts, sync, sharing, gamification, streaks, leaderboards, a word-level card type, multiple-choice answering, typing-the-answer input, or an FSRS/SM-2 implementation. Leitner is deliberate and sufficient at this deck size.

Do not add a "hard/good/easy" scale. Three grades, as specified.

---

## Build order

1. Data layer and IndexedDB schema, with the three stores
2. Import from JSON, and a seed batch of 4 dummy cards
3. Production mode review loop with three-button grading
4. Leitner scheduling and the due queue
5. Export
6. Cloze mode
7. Statistics view
8. Audio capture and playback

Stop after step 5 and confirm it works end to end with real cards before continuing. Steps 6–8 are worthless if the core loop has friction.
