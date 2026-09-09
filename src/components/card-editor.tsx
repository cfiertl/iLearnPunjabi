"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KNOWN_FRAME_TAGS } from "@/lib/frame-tags";
import { tokenize } from "@/lib/study/types";
import type { CardDetail } from "@/lib/cards/server";
import { setCardActive, updateCard } from "@/app/(app)/cards/actions";

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export function CardEditor({ card }: { card: CardDetail }) {
  const router = useRouter();
  const [f, setF] = useState({
    englishPrompt: card.englishPrompt,
    roman: card.roman,
    gurmukhi: card.gurmukhi,
    frameTag: card.frameTag ?? "",
    familyVariant: card.familyVariant ?? "",
    notes: card.notes ?? "",
    verified: card.verified,
    slotIndexRoman: card.slotIndexRoman,
    slotIndexGurmukhi: card.slotIndexGurmukhi,
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const romanTokens = tokenize(f.roman);
  const gurmukhiTokens = tokenize(f.gurmukhi);

  // The slot token is the romanised one by convention, derived from the index
  // rather than stored separately so editing cannot leave the two disagreeing.
  const slotToken =
    f.slotIndexRoman !== null && f.slotIndexRoman < romanTokens.length
      ? romanTokens[f.slotIndexRoman]
      : null;

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => {
      const next = { ...prev, [key]: value };
      // Editing the wording can strand an index past the end of the sentence.
      if (key === "roman" && next.slotIndexRoman !== null) {
        if (next.slotIndexRoman >= tokenize(next.roman).length) {
          next.slotIndexRoman = null;
        }
      }
      if (key === "gurmukhi" && next.slotIndexGurmukhi !== null) {
        if (next.slotIndexGurmukhi >= tokenize(next.gurmukhi).length) {
          next.slotIndexGurmukhi = null;
        }
      }
      return next;
    });
    setMsg(null);
  }

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await updateCard(card.id, {
          englishPrompt: f.englishPrompt,
          roman: f.roman,
          gurmukhi: f.gurmukhi,
          frameTag: f.frameTag,
          agreementSlot: slotToken,
          slotIndexRoman: f.slotIndexRoman,
          slotIndexGurmukhi: f.slotIndexGurmukhi,
          familyVariant: f.familyVariant,
          notes: f.notes,
          verified: f.verified,
        });
        setMsg("Saved.");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="English prompt">
        <input
          value={f.englishPrompt}
          onChange={(e) => set("englishPrompt", e.target.value)}
          className={FIELD}
        />
      </Field>

      <Field label="Romanisation">
        <input
          value={f.roman}
          onChange={(e) => set("roman", e.target.value)}
          className={FIELD}
        />
      </Field>

      <Field label="Gurmukhi">
        <input
          value={f.gurmukhi}
          onChange={(e) => set("gurmukhi", e.target.value)}
          className={`${FIELD} font-gurmukhi text-base`}
        />
      </Field>

      <Field
        label="Agreement slot"
        hint={
          slotToken
            ? `Testing "${slotToken}". Tap another word to change it.`
            : "Tap the word being tested. Cloze blanks this one."
        }
      >
        <TokenRow
          tokens={romanTokens}
          selected={f.slotIndexRoman}
          onPick={(i) => set("slotIndexRoman", i)}
        />
        {gurmukhiTokens.length > 0 && (
          <TokenRow
            tokens={gurmukhiTokens}
            selected={f.slotIndexGurmukhi}
            onPick={(i) => set("slotIndexGurmukhi", i)}
            gurmukhi
          />
        )}
      </Field>

      <Field label="Frame tag">
        <input
          value={f.frameTag}
          list="frame-tags"
          onChange={(e) => set("frameTag", e.target.value)}
          className={`${FIELD} font-mono text-xs`}
        />
        <datalist id="frame-tags">
          {KNOWN_FRAME_TAGS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>

      <Field
        label="How the family says it"
        hint="Authoritative where present. Shown on the card back."
      >
        <input
          value={f.familyVariant}
          onChange={(e) => set("familyVariant", e.target.value)}
          className={FIELD}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className={FIELD}
        />
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={f.verified}
          onChange={(e) => set("verified", e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--brand)]"
        />
        <span>
          <span className="text-sm font-medium">Gurmukhi spelling verified</span>
          <span className="block text-xs text-muted">
            Tick once someone who reads the script has checked it.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>

      <RetireButton card={card} />
    </div>
  );
}

/** Tap a word to mark it as the one under test. */
function TokenRow({
  tokens,
  selected,
  onPick,
  gurmukhi = false,
}: {
  tokens: string[];
  selected: number | null;
  onPick: (i: number) => void;
  gurmukhi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tokens.map((t, i) => (
        <button
          key={`${t}-${i}`}
          type="button"
          onClick={() => onPick(i)}
          aria-pressed={selected === i}
          className={`rounded-md border px-2 py-1 text-sm transition ${
            gurmukhi ? "font-gurmukhi" : ""
          } ${
            selected === i
              ? "border-accent bg-accent/15 text-accent"
              : "border-border text-muted hover:border-brand"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * Soft delete. A hard delete cascades to review_events, and that log is never
 * pruned — a retired card keeps every review it ever produced.
 */
function RetireButton({ card }: { card: CardDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="border-t border-border pt-4">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setCardActive(card.id, !card.active);
            router.refresh();
          })
        }
        className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          card.active
            ? "border-danger/40 text-danger hover:bg-danger/10"
            : "border-border hover:border-brand"
        }`}
      >
        {card.active ? "Retire this card" : "Restore this card"}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        {card.active
          ? "Removes it from review. Its review history is kept."
          : "Retired — not in any queue."}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {children}
    </div>
  );
}
