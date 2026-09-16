"use client";

import { useState } from "react";
import Link from "next/link";
import {
  OUTCOME_LABELS,
  bucketLabel,
  type Bucket,
  type Freeze,
  type Outcome,
} from "@/lib/freezes/types";
import { frameLabel } from "@/lib/frame-tags";

/**
 * View only. Buckets and outcomes are decided in session and arrive in a
 * session file; if the app could set them too, the two would eventually
 * disagree and the export would stop reflecting what was agreed.
 */
export function FreezeTriage({
  untriaged,
  parked,
  resolved,
}: {
  untriaged: Freeze[];
  parked: Freeze[];
  resolved: Freeze[];
}) {
  const [bucket, setBucket] = useState<"all" | Bucket>("all");
  const [outcome, setOutcome] = useState<"all" | Outcome>("all");

  const shown = resolved.filter(
    (f) =>
      (bucket === "all" || f.bucket === bucket) &&
      (outcome === "all" || f.outcome === outcome),
  );

  // Parked, grouped by the frame each is waiting on.
  const byFrame = new Map<string, Freeze[]>();
  for (const f of parked) {
    const key = f.waitingOn ?? "";
    byFrame.set(key, [...(byFrame.get(key) ?? []), f]);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted">
        Triage happens in session. Decisions arrive in the session file, applied
        from Cards → Import / Export.
      </p>

      <Section title={`Untriaged (${untriaged.length})`}>
        {untriaged.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
            Nothing waiting for the next session.
          </p>
        ) : (
          <List>
            {untriaged.map((f) => (
              <Row key={f.id} freeze={f} />
            ))}
          </List>
        )}
      </Section>

      {parked.length > 0 && (
        <Section title={`Parked (${parked.length})`}>
          {[...byFrame.entries()].map(([frame, list]) => (
            <div key={frame} className="flex flex-col gap-1.5">
              <h3 className="text-xs text-muted">
                Waiting on{" "}
                <Link
                  href={`/reference/frames#${frame}`}
                  className="font-medium text-foreground underline decoration-dotted underline-offset-2"
                >
                  {frameLabel(frame)}
                </Link>
              </h3>
              <List>
                {list.map((f) => (
                  <Row key={f.id} freeze={f} />
                ))}
              </List>
            </div>
          ))}
        </Section>
      )}

      {resolved.length > 0 && (
        <Section title={`Resolved (${resolved.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "A", "B", "C"] as const).map((b) => (
              <Chip key={b} active={bucket === b} onClick={() => setBucket(b)}>
                {b === "all" ? "Any bucket" : b}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "carded", "existing_card", "discarded"] as const).map((o) => (
              <Chip key={o} active={outcome === o} onClick={() => setOutcome(o)}>
                {o === "all" ? "Any outcome" : OUTCOME_LABELS[o]}
              </Chip>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">None match.</p>
          ) : (
            <List>
              {shown.map((f) => (
                <Row key={f.id} freeze={f} />
              ))}
            </List>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col rounded-2xl border border-border bg-surface px-4">
      {children}
    </ul>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-brand bg-brand/15 text-brand-strong"
          : "border-border text-muted hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ freeze }: { freeze: Freeze }) {
  const meta = [
    new Date(freeze.capturedAt).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    }),
    freeze.bucket && bucketLabel(freeze.bucket),
    freeze.outcome && OUTCOME_LABELS[freeze.outcome],
  ].filter(Boolean);

  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <p className="text-sm font-medium">{freeze.english}</p>
      <p className="mt-0.5 text-xs text-muted">{meta.join(" · ")}</p>
      {freeze.note && <p className="mt-1 text-xs">{freeze.note}</p>}
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
    </li>
  );
}
