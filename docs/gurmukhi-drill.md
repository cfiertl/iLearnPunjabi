# Gurmukhi Recognition Drill

The spec as built. Where the original brief left something open, the decision
taken is marked **(decided)**.

## Purpose

A two-minute daily drill for the six-week, read-only Gurmukhi track, which
exists to fix aspiration errors that romanisation cannot show. A Gurmukhi item
appears, Chris reads it aloud, then picks the reading from four options.

It is diagnostic first: **which wrong answer gets picked** and **how long
recognition takes** matter more than percent correct.

## Separation from the rest of the app

- Fully separate from the Leitner deck. It never creates cards, moves boxes, or
  feeds the agreement-fail rate or any frame statistic. Its tables are
  `gurmukhi_*`; nothing in `src/lib/gurmukhi` touches `cards`,
  `card_review_state` or `review_events`.
- It is the **only** place multiple choice is allowed (decided; recorded in
  AGENTS.md).
- No audio and no text-to-speech.
- The script-mode toggle is unaffected.

## Flow (`/study/gurmukhi`, one tap from Home)

A session is 20 items (`SESSION_LENGTH`). "End session" exits early; every
attempt is already saved.

1. **Show.** The item, large and centred, and a "Said it" button.
2. **Say.** Read aloud, tap "Said it" (or Space/Enter). `recognition_ms` runs
   from the item's commit to the screen until this tap. Options are not in the
   DOM during this stage.
3. **Pick.** Four options in random order (or keys 1-4). `pick_ms` runs from
   the options' commit to the tap.
4. **Feedback.** Correct or incorrect. On incorrect: the correct reading and,
   when the picked consonant shares a confusable set with the target, that set,
   e.g. "aspiration and voicing: ਖ vs ਕ". Tap anywhere to continue.

"Palm check" appears in small text during Say when the item's first letter is
ਖ ਛ ਠ ਥ or ਫ. On by default; Settings → "Gurmukhi drill: palm check hint".

End screen: correct / attempted, median `recognition_ms`, top three
(shown, picked) confusions of the session.

## Items

- `letter` — any unlocked letter. id `letter:<char>`.
- `syllable` — generated: every unlocked letter except the vowel carriers
  ੳ ਅ ੲ, with every unlocked mark. id `syllable:<consonant><mark>`. Label is
  consonant label + mark label. The string is **always consonant codepoint then
  mark codepoint**; the font draws ਿ on the left. A syllable is rare when its
  consonant is.
- `word` — authored and imported with explicit options. id `word:<id>`.

All 35 seeded letters start unlocked (decided). Marks ਾ ਿ ੀ start unlocked;
the rest wait for an import.

## Distractors

**Letters** — 3 distractors, distinct labels, from unlocked letters only, in
priority tiers (random within a tier): every set containing the target, pooled;
then the same grid row; then any unlocked letter.

**Syllables** — at least one of each kind where possible, then the remaining
slot alternates between kinds:
- same consonant with another unlocked mark, or no mark (inherent `a`: `ka`);
- a confusable consonant (the letter tiers, carriers excluded) with the same mark.

**Words** — the three authored options. Authoring rule for Claude: each
distractor differs from the reading by exactly one change, either a confusable
letter swap or a vowel-length swap.

## Weighting (not a second SRS)

```
weight = (1 + 2 * recent_errors + slow + new) * rare_factor
```

- `recent_errors` — incorrect among the item's last 5 attempts.
- `slow` — 1 if the item's median `recognition_ms` over its last 5 is in the
  slowest quarter of items with at least 3 attempts.
- `new` — 1 if fewer than 3 attempts.
- `rare_factor` — 0.25 for rare items.
- The same item never appears twice in a row.

Each slot's item is drawn when it is reached, so an item missed earlier in the
same session is already weighted up (decided).

Mix: 14 letters + 6 syllables while no words exist; 8 / 6 / 6 once they do
(largest-remainder quotas, shuffled order). All numbers are constants in
`src/lib/gurmukhi/types.ts`.

## Offline (decided)

Attempts go into a localStorage queue the moment they are picked and are
uploaded directly by the browser, on each pick, on page load and when the
connection returns. Ids are generated in the browser and inserts ignore
duplicates, so a retried upload lands once. Recently uploaded attempts are kept
locally too, so weighting is right even when the page itself comes from the
service-worker cache. The drill page must have been opened online once for the
service worker to have it.

## Statistics (bottom of `/stats`, separate from card stats)

Syllables count through their consonant (decided): a syllable belongs to its
consonant's sets, and a pick with a different consonant is a consonant
confusion. Words feed slowest items and trend only.

1. **Slowest items** — median `recognition_ms` over the last 10 attempts.
2. **Confusions** — (shown, picked) with counts, flagged known set / not in a set.
3. **Candidate pairs** — consonant pairs confused ≥ 3 times and not together in
   any set. Display only; added through import.
4. **Accuracy by set.**
5. **Trend** — median `recognition_ms` per session.

◆ marks anything containing a letter still `pendingFamilyCheck`.

## Data

Tables (migration 0011): `gurmukhi_letters`, `gurmukhi_marks`, `gurmukhi_sets`,
`gurmukhi_words`, and append-only `gurmukhi_attempts`. Seed data is in
`src/content/gurmukhi-seed.ts` and is written once per user on first use; after
that the database is the truth.

Romanisation: a capital marks retroflex (`T Th D Dh N L`), `h` after a consonant
marks aspiration. Column 4 of rows 2-6 is `pendingFamilyCheck` (it may be tone
rather than aspiration in the family's speech, awaiting Jasmine).

Attempt record (as exported):

```json
{
  "attemptId": "uuid",
  "sessionId": "uuid",
  "timestamp": "ISO 8601",
  "itemId": "letter:ਖ",
  "itemType": "letter",
  "shown": "ਖ",
  "correctLabel": "kh",
  "pickedLabel": "k",
  "pickedChar": "ਕ",
  "pickedShown": "ਕ",
  "correct": false,
  "recognitionMs": 2140,
  "pickMs": 860
}
```

`pickedChar` is filled for letter items only. `pickedShown` (decided, extra
field) is the Gurmukhi of the picked option for letters **and** syllables, so a
syllable pick can be read back as a consonant confusion.

## Raw export

Two fields added to Cards → Export; every existing field is unchanged:

- `gurmukhiAttempts` — every attempt, oldest first.
- `gurmukhiItems` — `{ letters, marks, confusableSets, words }` with labels,
  unlock state and `pendingFamilyCheck`.

## Session import: `gurmukhi` section

Optional, in the `punjabi-import/1` file. **camelCase keys** to match the rest
of the file (decided). Absent, import behaves exactly as before. Unknown keys
inside it are warnings. Any error rejects the whole file, like everything else
in it. The preview and the applied summary list every Gurmukhi change.

```json
{
  "gurmukhi": {
    "unlockMarks": ["ੁ", "ੂ"],
    "unlockLetters": ["ਖ਼"],
    "addLetters": [
      { "char": "ਖ਼", "label": "x", "row": 8, "col": 1, "rare": false, "pendingFamilyCheck": false }
    ],
    "labelUpdates": [
      { "char": "ਘ", "label": "gh", "pendingFamilyCheck": false }
    ],
    "addConfusableSets": [
      { "id": "shape_y_m", "kind": "shape", "chars": ["ਯ", "ਮ"], "description": "similar shape" }
    ],
    "addWords": [
      { "id": "w_daal", "gurmukhi": "ਦਾਲ", "reading": "daal", "options": ["dal", "taal", "Daal"], "sourceCardId": null, "addedWeek": 2 }
    ]
  }
}
```

The values above illustrate shape only; they are not confirmed content.

Rules:
- Idempotent by id: a letter (by `char`), set or word that exists is updated,
  not duplicated.
- `addLetters` (decided, not in the original brief) adds a letter **locked**;
  unlock it with `unlockLetters`, in the same file or later. Updating an
  existing letter keeps its unlock state. Omitted `rare` /
  `pendingFamilyCheck` keep the current value (false for a new letter).
- `labelUpdates` takes a letter or a vowel mark; marks take `label` only.
- Unlocking is one way. There is no lock action.
- `addWords.options` is exactly 3 distinct distractors, not including the
  reading. `sourceCardId` is a note, never a link; an unknown id is a warning.
- `addConfusableSets.chars` needs at least two known letters. `kind` other than
  `column` / `place` / `shape` is a warning.
- Two unlocked letters with the same label is a warning: only one can appear
  per question.

## Out of scope

Audio of any kind; writing or tracing; reverse direction (reading shown, pick
the letter); moving Gurmukhi items into the Leitner deck; automatic
transliteration of words.
