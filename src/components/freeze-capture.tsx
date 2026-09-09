"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { captureFreeze } from "@/app/(app)/freezes/actions";

/**
 * One field, one button, nothing else.
 *
 * Deliberately absent, and must stay absent: translation, lookup, suggestion,
 * autocomplete, hints, categorising at capture time, and any confirm step. A
 * freeze records what could not be done unaided — an affordance that resolves
 * it in the moment destroys the data it exists to collect.
 *
 * Stays on the screen after saving so consecutive captures need no navigation.
 */
export function FreezeCapture() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function save() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await captureFreeze(value);
      setText("");
      setSaved((n) => n + 1);
      inputRef.current?.focus();
      router.refresh();
    } catch {
      setError("Didn't save — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <label htmlFor="freeze" className="text-sm text-muted">
        What did you want to say?
      </label>
      <textarea
        id="freeze"
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter saves; Shift+Enter for a rare multi-line capture.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
        rows={3}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="In English. Ten seconds. Don't look it up."
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      <button
        onClick={() => void save()}
        disabled={!text.trim() || busy}
        className="rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>

      <p className="min-h-[1.25rem] text-center text-sm" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : saved > 0 ? (
          <span className="text-success">
            Saved. {saved} this session — keep going.
          </span>
        ) : (
          <span className="text-muted">
            Don&apos;t resolve it. The pattern across twenty is the point.
          </span>
        )}
      </p>
    </section>
  );
}
