# ILearnPunjabi — Setup & Deploy

Personal Punjabi **sentence production trainer** (see `buildplan.md`).
Stack: Next.js 16 + Supabase + Vercel.

## Run locally (works before Supabase is connected)

```bash
npm install
npm run dev        # http://localhost:3000
```

Until Supabase is connected you will see a "Finish setup" banner and cannot
sign in.

## 1. Create the Supabase project

1. https://supabase.com → **New project** (free tier is fine). Pick a region
   near you (e.g. Southeast Asia if you are in MY/SG).
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Paste them into `.env.local`, then restart `npm run dev`.

## 2. Create the database tables

In the Supabase dashboard → **SQL Editor**, run these in order. All are
idempotent, so re-running is safe.

1. [`supabase/schema.sql`](supabase/schema.sql) — base tables, RLS, signup
   trigger, the `card-audio` Storage bucket.
2. [`supabase/migrations/0002_usage_tracking.sql`](supabase/migrations/0002_usage_tracking.sql)
   — legacy AI spend meter. No longer used by the app; run it only if you are
   restoring an older database that expects those columns.
3. [`supabase/migrations/0003_sentence_trainer.sql`](supabase/migrations/0003_sentence_trainer.sql)
   — **required**. Adds the sentence/agreement fields, per-mode review state,
   the append-only `review_events` log, audio clip metadata, and the queue and
   statistics functions.

Migration 0003 is purely additive: the older FSRS tables (`review_state`,
`review_logs`, `daily_activity`) are left untouched, and any word-level cards
already in `cards` simply stop appearing because their `frame_tag` is null.

## 3. Turn off email confirmation (single-user convenience)

**Authentication → Providers → Email** → turn **off** "Confirm email" so your
first sign-up logs you straight in.

## 4. Create your account & load cards

1. Open the app → **Create your account** → sign in.
2. Go to **Cards**. With an empty bank you will be offered a **seed batch** of
   4 dummy sentence cards — enough to exercise the loop end to end.
3. To load real cards, paste a JSON array into the import box and hit
   **Validate**, then **Import**. Schema:

```json
[
  {
    "englishPrompt": "I ate roti yesterday",
    "gurmukhi": "ਮੈਂ ਕੱਲ੍ਹ ਰੋਟੀ ਖਾਧੀ",
    "roman": "main kal roti khadhi",
    "frameTag": "perfective_object_agr",
    "agreementSlot": "khadhi",
    "slotIndexRoman": 3,
    "slotIndexGurmukhi": 3,
    "notes": "roti is feminine, so the past verb takes -i"
  }
]
```

`englishPrompt`, `gurmukhi`, `roman` and `frameTag` are required; the rest are
optional. `slotIndex*` are whitespace-token indexes into the matching sentence
(0-based). Unknown `frameTag` values are warned about, not rejected. Importing
the same batch twice adds nothing.

## 5. Study

**Study** shows the English prompt only. Say the whole sentence aloud, wait for
the Flip button to arm, then grade with **1** / **2** / **3**:

| Key | Grade | Effect |
| --- | --- | --- |
| 1 | Got it | box + 1 (max 5) |
| 2 | Right words, wrong agreement | back to box 1, due tomorrow, logged as an agreement fail |
| 3 | Couldn't produce it | back to box 1, due tomorrow, logged as a lapse |

Box intervals are 1, 2, 4, 8, 16 days. Sessions cap at 30 reviews and 10 new
cards a day — both adjustable in **Settings**, along with the flip pause.

## 6. Export

**Cards → Download JSON** produces a pretty-printed file with every card,
schedule, and review event, for pasting into a tutoring conversation. Audio
files are excluded.

## 7. Deploy to Vercel

1. Push this folder to a private GitHub repo.
2. https://vercel.com → **Add New → Project** → import the repo.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in Vercel project settings.
4. Deploy. Open the URL on your phone → browser menu → **Add to Home Screen**.
5. Back in Supabase → **Authentication → URL Configuration**, add your Vercel
   URL to the allowed redirect/site URLs.

## Notes

- **Gurmukhi is shown to you**, large, as the primary text on card backs, with
  romanisation beneath it. This reverses the original romanized-only rule.
  The app loads Noto Sans Gurmukhi so the script renders properly.
- Not built yet (build-plan steps 6–8): cloze mode, the statistics view, and
  in-app audio recording. The database already has room for all three.
- `GOOGLE_TTS_API_KEY` is no longer used — card audio will come from your own
  recordings rather than synthesis.
- Superseded files (AI tutor chat, spend tracking, FSRS, the word-level starter
  deck) are parked in `.archive/` rather than deleted, since this folder is not
  under version control. Delete it when you are happy.
