"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GRADES, type Grade, type ReviewMode } from "@/lib/leitner";
import { frameRule } from "@/lib/frame-tags";
import { resolveSlotIndex, tokenize } from "@/lib/study/types";
import type { TrainerCard } from "@/lib/study/types";
import { submitGrade } from "@/app/(app)/study/actions";

type Props = {
  initialQueue: TrainerCard[];
  mode: ReviewMode;
  flipDelayMs: number;
};

export function ReviewSession({ initialQueue, mode, flipDelayMs }: Props) {
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

  const card = queue[index];
  const done = !card;

  const rate = useCallback(
    async (grade: Grade) => {
      if (busy || !card) return;
      setBusy(true);
      try {
        await submitGrade(card.id, mode, grade);
      } catch {
        // The session keeps moving even if a write hiccups; the card simply
        // stays due and comes back around.
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
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-bold">Session complete</p>
        <p className="text-sm text-muted">{total} reviewed</p>
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

  const progress = Math.round((index / queue.length) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>
            {index + 1} / {queue.length}
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
        <CardBack card={card} mode={mode} />
      ) : (
        <CardFront card={card} mode={mode} />
      )}

      {!revealed ? (
        <FlipButton delayMs={flipDelayMs} onFlip={() => setRevealed(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => void rate(g.grade)}
              disabled={busy}
              className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition disabled:opacity-50 ${g.cls}`}
            >
              <span>{g.label}</span>
              <span className="text-xs opacity-60">{g.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FACE =
  "flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center";

/**
 * Front.
 *
 * Production: the English prompt and nothing else — no hint, no audio.
 * Cloze: the Gurmukhi sentence with the agreement slot blanked, the English
 * prompt small underneath for context only.
 */
function CardFront({ card, mode }: { card: TrainerCard; mode: ReviewMode }) {
  if (mode === "cloze") {
    return (
      <div className={FACE}>
        <SlotSentence card={card} treatment="blank" />
        <p className="text-sm text-muted">{card.englishPrompt}</p>
        <p className="mt-3 text-sm font-medium text-brand-strong">
          Say the missing word aloud, then flip.
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
 * The Gurmukhi sentence with its agreement slot either blanked out or picked
 * out. `resolveSlotIndex` returning null cannot happen here — the cloze queue
 * filters those cards out precisely so the front never prints the answer — but
 * blank defensively rather than reveal if it somehow does.
 */
function SlotSentence({
  card,
  treatment,
}: {
  card: TrainerCard;
  treatment: "blank" | "highlight";
}) {
  const parts = tokenize(card.gurmukhi);
  const slot = resolveSlotIndex(
    card.gurmukhi,
    card.slotIndexGurmukhi,
    card.agreementSlot,
  );

  return (
    <p className="font-gurmukhi text-4xl font-semibold leading-relaxed">
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
function CardBack({ card, mode }: { card: TrainerCard; mode: ReviewMode }) {
  const rule = frameRule(card.frameTag);
  return (
    <div className={FACE}>
      {/* Cloze picks the slot out of the full sentence; production shows it whole. */}
      {mode === "cloze" ? (
        <SlotSentence card={card} treatment="highlight" />
      ) : (
        <p className="font-gurmukhi text-4xl font-semibold leading-relaxed">
          {card.gurmukhi}
        </p>
      )}
      <p className="text-base text-muted">{card.roman}</p>
      <p className="text-sm text-muted">{card.englishPrompt}</p>

      {card.notes && (
        <p className="mt-2 max-w-sm text-sm text-foreground/80">{card.notes}</p>
      )}
      {rule && (
        <p className="mt-1 max-w-sm rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {rule}
        </p>
      )}

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
