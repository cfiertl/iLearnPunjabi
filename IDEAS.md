# Ideas — not scheduled, not built

Parking space for things worth doing later. Nothing here is committed to; the
authoritative scope is `buildplan.md`.

---

## Freeze-list capture from iPhone

**The idea.** Keep a running "freeze list" — moments in real conversation where
you froze and could not produce something. Those are genuine production
failures, which makes them far better card material than guessed-at vocabulary.
Capture them on the phone the moment they happen, then turn them into cards.

**Why it fits.** The app is a sentence production trainer. A freeze is exactly
the failure it exists to fix, and capturing in the moment beats trying to
remember at a desk hours later.

**Sketch of the plumbing.** iOS Shortcuts cannot use the Supabase session
cookie, so the two options are a Shortcut that exchanges email/password for a
JWT on every run (clunky, tokens expire hourly), or:

1. `POST /api/capture` — a Next.js route handler in this app, guarded by a long
   random shared secret in an env var, writing rows with the service-role key
   server-side so RLS is bypassed safely.
2. A `capture_inbox` table: raw text, captured_at, and a `processed` flag.
3. An iOS Shortcut on the Home Screen or Back Tap that prompts "what did you
   freeze on?" and POSTs the answer. A Share Sheet variant could send selected
   text straight from Apple Notes (Shortcuts does have Notes actions, so reading
   a specific note is possible too).
4. Drafting: paste the inbox into a conversation, get back JSON in the existing
   import schema (englishPrompt / gurmukhi / roman / frameTag / agreementSlot),
   and import it through the Cards page. Import is already idempotent and warns
   on unknown frame tags, so drafts can be re-imported as they are refined.

**Open questions.**
- Does the freeze get captured in English ("I couldn't say I would have gone"),
  or as a fumbled Punjabi attempt? Changes what the drafting step has to do.
- Worth a small in-app inbox screen to triage captures, or is export enough?
- `buildplan.md` says "no backend beyond static hosting". A capture endpoint
  widens that. Keeping Supabase already did, but this is a deliberate choice
  rather than an accident.
