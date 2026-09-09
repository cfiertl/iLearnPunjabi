"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUCKETS, type Bucket, type Freeze } from "@/lib/freezes/types";
import {
  discardFreeze,
  reopenFreeze,
  triageFreeze,
} from "@/app/(app)/freezes/actions";

export function FreezeTriage({
  untriaged,
  triaged,
}: {
  untriaged: Freeze[];
  triaged: Freeze[];
}) {
  const [filter, setFilter] = useState<"all" | Bucket | "discarded">("all");

  const shown = triaged.filter((f) => {
    if (filter === "all") return true;
    if (filter === "discarded") return f.bucket === null;
    return f.bucket === filter;
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          To triage ({untriaged.length})
        </h2>
        {untriaged.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          untriaged.map((f) => <TriageRow key={f.id} freeze={f} />)
        )}
      </section>

      {triaged.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Triaged
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "A", "B", "C", "discarded"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === f
                    ? "border-brand bg-brand/15 text-brand-strong"
                    : "border-border text-muted hover:border-brand"
                }`}
              >
                {f === "all" ? "All" : f === "discarded" ? "Discarded" : f}
              </button>
            ))}
          </div>
          {shown.map((f) => (
            <DoneRow key={f.id} freeze={f} />
          ))}
        </section>
      )}
    </div>
  );
}

function TriageRow({ freeze }: { freeze: Freeze }) {
  const router = useRouter();
  const [note, setNote] = useState(freeze.note ?? "");
  const [pending, start] = useTransition();

  function act(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <p className="text-base font-medium">{freeze.english}</p>
        <p className="mt-0.5 text-xs text-muted">
          {new Date(freeze.capturedAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
      />

      <div className="flex flex-col gap-1.5">
        {BUCKETS.map((b) => (
          <button
            key={b.bucket}
            disabled={pending}
            onClick={() => act(() => triageFreeze(freeze.id, b.bucket, note))}
            className="flex flex-col items-start rounded-lg border border-border px-3 py-2 text-left text-sm font-medium transition hover:border-brand disabled:opacity-50"
          >
            <span>{b.label}</span>
            <span className="text-xs font-normal text-muted">{b.hint}</span>
          </button>
        ))}
      </div>

      <button
        disabled={pending}
        onClick={() => act(() => discardFreeze(freeze.id))}
        className="self-start text-xs text-muted underline hover:text-danger disabled:opacity-50"
      >
        Discard
      </button>
    </article>
  );
}

function DoneRow({ freeze }: { freeze: Freeze }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <article className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
      <div className="min-w-0">
        <p className="truncate">{freeze.english}</p>
        <p className="text-xs text-muted">
          {freeze.bucket ? `Bucket ${freeze.bucket}` : "Discarded"}
          {freeze.note ? ` · ${freeze.note}` : ""}
        </p>
        {/* The cards this freeze became. Display-only. */}
        {freeze.cards.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {freeze.cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cards/${c.id}`}
                  className="text-xs text-brand-strong underline"
                >
                  {c.englishPrompt}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await reopenFreeze(freeze.id);
            router.refresh();
          })
        }
        className="shrink-0 text-xs text-muted underline hover:text-brand-strong disabled:opacity-50"
      >
        Reopen
      </button>
    </article>
  );
}
