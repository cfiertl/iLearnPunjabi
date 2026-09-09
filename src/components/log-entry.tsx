"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOG_KINDS, type LogDay, type LogKind } from "@/lib/log/types";
import { toggleLogEntry } from "@/app/(app)/log/actions";

/**
 * Log one day's routine. Defaults to today, but the date can be moved back —
 * Sunday's block usually gets recorded on Monday.
 */
export function LogEntry({
  today,
  days,
}: {
  today: string;
  days: LogDay[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const day = days.find((d) => d.day === date);
  const active = new Set(day?.kinds ?? []);

  function toggle(kind: LogKind) {
    const on = !active.has(kind);
    setError(null);
    startTransition(async () => {
      try {
        await toggleLogEntry(date, kind, on);
        router.refresh();
      } catch {
        setError("Couldn't save that — check your connection.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Log a day
        </h2>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {LOG_KINDS.map((k) => {
          const on = active.has(k.kind);
          return (
            <button
              key={k.kind}
              onClick={() => toggle(k.kind)}
              disabled={pending}
              aria-pressed={on}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                on
                  ? "border-brand bg-brand/15 text-brand-strong"
                  : "border-border text-muted hover:border-brand"
              }`}
            >
              {on ? "✓ " : ""}
              {k.label}
              <span className="ml-1.5 text-xs opacity-70">{k.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Cards are not a button: the app already knows, from review_events. */}
      <p className="text-xs text-muted">
        Cards:{" "}
        {day && day.reviews > 0 ? (
          <span className="font-medium text-foreground">
            {day.reviews} review{day.reviews === 1 ? "" : "s"} recorded
          </span>
        ) : (
          "nothing recorded"
        )}{" "}
        — logged automatically from your reviews, not entered here.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
