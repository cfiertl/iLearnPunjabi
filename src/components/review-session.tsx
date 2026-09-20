"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GRADES, type Grade, type ReviewMode } from "@/lib/leitner";
import { frameRule } from "@/lib/frame-tags";
import { primaryText, resolveSlotIndex, tokenize } from "@/lib/study/types";
import type { ScriptMode, TrainerCard } from "@/lib/study/types";
import { submitGrade } from "@/app/(app)/study/actions";

type Props = {
  initialQueue: TrainerCard[];
  mode: ReviewMode;
  flipDelayMs: number;
  scriptMode: ScriptMode;
  /**
   * Cards already reviewed in this mode today, from earlier sittings. The
   * counter runs across the whole day's set rather than restarting at 1 each
   * time the page is opened — stopping and coming back is meant to continue a
   * day, not begin one.
   */
  doneToday: number;
  /** An extra session past the daily cap, so there is no day total to count against. */
  extra: boolean;
};

export function ReviewSession({
  initialQueue,
  mode,
  flipDelayMs,
  scriptMode,
  doneToday,
  extra,
}: Props) {
  const router = useRouter();

  // Snapshot the queue for the life of the session. Grading calls a server
  // action, which refreshes this route and re-runs the due query — the card
  // just graded drops out, so the array would shrink under us and `index`
  // would land on the wrong card, silently skipping every other one.
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ correct: 0, agreement: 0, fail: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  const card = queue[index];
  const done = stopped || !card;

  const rate = useCallback(
    async (grade: Grade) => {
      if (busy || !card) return;
      setBusy(true);
      setSaveError(null);

      // A grade that does not reach the server must never look like it did.
      // review_events is the diagnostic record the whole app exists to
      // produce, so a silently dropped write costs more than the interruption
      // of asking for the grade again. One quiet retry, then stop and say so.
      let saved = false;
      for (let attempt = 0; attempt < 2 && !saved; attempt++) {
        try {
          // The browser is the only party that knows the learner day boundary.
          await submitGrade(
            card.id,
            mode,
            grade,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          );
          saved = true;
        } catch {
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }

      if (!saved) {
        setSaveError(
          "That grade didn't save — check your connection and grade it again.",
        );
        setBusy(false);
        return; // stay on this card; nothing was recorded
      }

      setTally((t) => ({ ...t, [grade]: t[grade] + 1 }));
      setBusy(false);
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [busy, card, mode],
  );

  // Keyboard shortcuts 1 / 2 / 3, active only once the answer is showing.
  useEffect(() => {
    if (!revealed) return;
    function onKey(e: KeyboardEvent) {
      const hit = GRADES.find((g) => g.key === e.key);
      if (hit) {
        e.preventDefault();
        void rate(hit.grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, rate]);

  if (done) {
    const total = tally.correct + tally.agreement + tally.fail;
    const left = queue.length - index;
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-bold">
          {stopped ? "Stopped there" : "Session complete"}
        </p>
        <p className="text-sm text-muted">{total} reviewed</p>
        {/* Every grade is already saved, so the rest of the day's set is
            genuinely waiting — say so, rather than leaving the impression that
            leaving early threw the sitting away. */}
        {stopped && left > 0 && (
          <p className="max-w-xs text-sm text-muted">
            {left} still to go — they&rsquo;ll be here when you come back.
          </p>
        )}
        <dl className="grid w-full grid-cols-3 gap-2 text-center">
          <Tally label="Got it" value={tally.correct} />
          <Tally label="Agreement" value={tally.agreement} />
          <Tally label="Couldn't" value={tally.fail} />
        </dl>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong"
        >
          Back to home
        </button>
      </div>
    );
  }

  // Progress is measured against the day's set, not this sitting's slice of
  // it, so a second visit picks up where the first stopped.
  const position = doneToday + index;
  const dayTotal = doneToday + queue.length;
  const progress = Math.round((position / dayTotal) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>
            {position + 1} / {dayTotal}
            {extra && " · extra"}
          </span>
          <span>Box {card.box}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {revealed ? (
        <CardBack card={card} mode={mode} scriptMode={scriptMode} />
      ) : (
        <CardFront card={card} mode={mode} scriptMode={scriptMode} />
      )}

      {!revealed ? (
        <FlipButton delayMs={flipDelayMs} onFlip={() => setRevealed(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {saveError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {saveError}
            </p>
          )}
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => void rate(g.grade)}
              disabled={busy}
              className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition disabled:opacity-50 ${g.cls}`}
            >
              <span>{g.label}</span>
              <span className="text-xs opacity-60">
                {busy ? "…" : g.key}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Leaving mid-set is a normal way to use this, not a failure: nothing is
          lost, and the remaining cards stay in today's set. Making that exit
          explicit beats navigating away and wondering what was kept. */}
      <button
        onClick={() => setStopped(true)}
        disabled={busy}
        className="self-center text-xs text-muted underline underline-offset-2 hover:text-brand-strong disabled:opacity-50"
      >
        End session here
      </button>
    </div>
  );
}

const FACE =
  "flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center";

/**
 * Front.
 *
 * Production: the English prompt and nothing else — no hint, no audio.
 * Cloze: the primary-script sentence with the agreement slot blanked, the
 * English prompt small underneath for context only.
 */
function CardFront({
  card,
  mode,
  scriptMode,
}: {
  card: TrainerCard;
  mode: ReviewMode;
  scriptMode: ScriptMode;
}) {
  if (mode === "cloze") {
    return (
      <div className={FACE}>
        {/* Only the primary script appears here. Showing the other one would
            print the very token being blanked. */}
        <SlotSentence card={card} treatment="blank" scriptMode={scriptMode} />
        <p className="text-sm text-muted">{card.englishPrompt}</p>
        {/* The whole sentence, not the missing word alone: it still isolates
            the agreement decision, and costs nothing to get production reps
            rather than single-word recall. */}
        <p className="mt-3 text-sm font-medium text-brand-strong">
          Say the whole sentence aloud, filling the blank — then flip.
        </p>
      </div>
    );
  }

  return (
    <div className={`${FACE} gap-6`}>
      <p className="text-2xl font-bold">{card.englishPrompt}</p>
      <p className="text-sm font-medium text-brand-strong">
        Say the full sentence aloud, then flip.
      </p>
    </div>
  );
}

/**
 * The sentence — in whichever script leads — with its agreement slot either
 * blanked out or picked out. `resolveSlotIndex` returning null cannot happen
 * here, since the cloze queue drops those cards precisely so the front never
 * prints the answer, but blank defensively rather than reveal if it somehow
 * does.
 */
function SlotSentence({
  card,
  treatment,
  scriptMode,
}: {
  card: TrainerCard;
  treatment: "blank" | "highlight";
  scriptMode: ScriptMode;
}) {
  const { text, slotIndex } = primaryText(card, scriptMode);
  const gurmukhi = scriptMode === "gurmukhi_primary";
  const parts = tokenize(text);
  const slot = resolveSlotIndex(text, slotIndex, card.agreementSlot);

  return (
    <p
      className={
        gurmukhi
          ? "font-gurmukhi text-4xl font-semibold leading-relaxed"
          : "text-3xl font-bold leading-relaxed"
      }
    >
      {parts.map((token, i) => {
        // Slot unknown: blank everything (safe) rather than highlight
        // everything (noise).
        const isSlot = slot === null ? treatment === "blank" : i === slot;
        if (!isSlot) return <span key={i}>{token} </span>;
        return treatment === "blank" ? (
          <span key={i} className="text-muted">
            ____{" "}
          </span>
        ) : (
          <span key={i} className="rounded bg-accent/20 px-1.5 text-accent">
            {token}
          </span>
        );
      })}
    </p>
  );
}

/**
 * Back: Gurmukhi is the primary display, romanisation is secondary.
 * Romanisation cannot represent aspiration or tone, and script recognition is
 * being trained in parallel — the type sizes reflect that hierarchy.
 */
function CardBack({
  card,
  mode,
  scriptMode,
}: {
  card: TrainerCard;
  mode: ReviewMode;
  scriptMode: ScriptMode;
}) {
  const rule = frameRule(card.frameTag);
  const gurmukhiFirst = scriptMode === "gurmukhi_primary";

  return (
    <div className={FACE}>
      {/* Cloze picks the slot out of the full sentence; production shows it whole. */}
      {mode === "cloze" ? (
        <SlotSentence card={card} treatment="highlight" scriptMode={scriptMode} />
      ) : gurmukhiFirst ? (
        <p className="font-gurmukhi text-4xl font-semibold leading-relaxed">
          {card.gurmukhi}
        </p>
      ) : (
        <p className="text-3xl font-bold leading-relaxed">{card.roman}</p>
      )}

      {/* The secondary script sits underneath, smaller. */}
      {gurmukhiFirst ? (
        <p className="text-base text-muted">{card.roman}</p>
      ) : (
        <p className="font-gurmukhi text-lg text-muted">{card.gurmukhi}</p>
      )}
      <p className="text-sm text-muted">{card.englishPrompt}</p>

      {/* The answer above is the form to produce: the family's, wherever they
          have confirmed one. These are the alternatives, both display-only. A
          family variant counts as correct too; the standard form is shown so
          it is recognised, not so it is said. */}
      {card.familyVariant && (
        <p className="mt-2 max-w-sm rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-accent">
            Also said in the family
          </span>
          <span className="mt-0.5 block">{card.familyVariant}</span>
        </p>
      )}
      {card.standardRoman && (
        <p className="max-w-sm text-xs text-muted">
          Standard Punjabi: {card.standardRoman}
        </p>
      )}

      {card.notes && (
        <p className="mt-2 max-w-sm text-sm text-foreground/80">{card.notes}</p>
      )}

      {!card.verified && (
        <p className="text-xs text-muted" title="Gurmukhi not yet checked by a reader">
          · spelling unverified
        </p>
      )}
      {/* Cloze links the rule straight to its row in the frame reference —
          the only place the reference is wired into app behaviour. */}
      {rule &&
        (mode === "cloze" ? (
          <Link
            href={`/reference/frames#${card.frameTag}`}
            className="mt-1 max-w-sm rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-brand-strong"
          >
            {rule}
          </Link>
        ) : (
          <p className="mt-1 max-w-sm rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            {rule}
          </p>
        ))}

      {/* Playback lives on the back only — hearing it first defeats the drill. */}
      {card.audioUrl && (
        <PlayButton url={card.audioUrl} speaker={card.audioSpeaker} />
      )}
    </div>
  );
}

function PlayButton({ url, speaker }: { url: string; speaker: string | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  return (
    <button
      onClick={() => {
        ref.current?.pause();
        const el = new Audio(url);
        ref.current = el;
        void el.play().catch(() => {});
      }}
      className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-brand"
    >
      <span>🔊</span> {speaker ? `Play (${speaker})` : "Play"}
    </button>
  );
}

/**
 * A deliberate friction beat before flipping is possible, so "check the answer"
 * cannot become a reflex that replaces actually attempting production.
 */
function FlipButton({
  delayMs,
  onFlip,
}: {
  delayMs: number;
  onFlip: () => void;
}) {
  // Remounted for every card (the grade buttons replace it once flipped), so
  // the initial state is already correct — the effect only arms the timer.
  const [ready, setReady] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <button
      onClick={onFlip}
      disabled={!ready}
      className="rounded-xl bg-brand px-5 py-3.5 font-semibold text-brand-contrast transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
    >
      {ready ? "Flip" : "Say it aloud…"}
    </button>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  );
}
