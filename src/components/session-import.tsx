"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applySessionImport,
  previewSessionImport,
} from "@/app/(app)/cards/session-actions";
import type { FieldChange, SessionPreview } from "@/lib/imports/session";
import { BUCKETS, OUTCOME_LABELS } from "@/lib/freezes/types";
import { frameLabel } from "@/lib/frame-tags";

/**
 * Apply the file Claude writes at the end of a session. Upload, read the
 * preview, apply. Nothing here edits anything by hand — that is the point.
 */
export function SessionImport() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<SessionPreview | null>(null);
  const [applied, setApplied] = useState<SessionPreview | null>(null);
  const [busy, setBusy] = useState<null | "check" | "apply">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset(text: string) {
    setRaw(text);
    setPreview(null);
    setApplied(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) reset(await file.text());
  }

  async function check() {
    setBusy("check");
    try {
      setPreview(await previewSessionImport(raw));
    } catch (e) {
      setPreview(failure(e));
    }
    setBusy(null);
  }

  async function apply() {
    setBusy("apply");
    try {
      const r = await applySessionImport(raw);
      if (r.ok) {
        setApplied(r.preview);
        setPreview(null);
        setRaw("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        setPreview(r.preview);
      }
    } catch (e) {
      setPreview(failure(e));
    }
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Session file
      </h2>
      <p className="text-sm text-muted">
        The file from the end of a session: new cards, card changes and freeze
        triage. Check it, read every change, then apply. It lands whole or not
        at all.
      </p>

      {applied ? (
        <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          <p className="font-medium text-success">Applied {applied.batchId}</p>
          <p className="text-muted">{applied.summary}</p>
          <Counts preview={applied} />
          <button
            onClick={() => setApplied(null)}
            className="self-start text-xs text-muted underline hover:text-brand-strong"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={raw}
            onChange={(e) => reset(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder='{ "schema": "punjabi-import/1", … }'
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />

          {preview && <Preview preview={preview} />}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={check}
              disabled={!raw.trim() || busy !== null}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-brand disabled:opacity-50"
            >
              {busy === "check" ? "Checking…" : "Check"}
            </button>
            <button
              onClick={apply}
              disabled={!preview?.ok || busy !== null}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
            >
              {busy === "apply" ? "Applying…" : "Apply"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function failure(e: unknown): SessionPreview {
  return {
    ok: false,
    errors: [e instanceof Error ? e.message : "Something went wrong."],
    warnings: [],
    batchId: null,
    summary: null,
    cardsAdded: [],
    cardsUpdated: [],
    freezesUpdated: [],
  };
}

function Counts({ preview }: { preview: SessionPreview }) {
  return (
    <p className="text-xs text-muted">
      <strong className="text-foreground">{preview.cardsAdded.length}</strong> new
      card{preview.cardsAdded.length === 1 ? "" : "s"} ·{" "}
      <strong className="text-foreground">{preview.cardsUpdated.length}</strong> card
      update{preview.cardsUpdated.length === 1 ? "" : "s"} ·{" "}
      <strong className="text-foreground">{preview.freezesUpdated.length}</strong>{" "}
      freeze{preview.freezesUpdated.length === 1 ? "" : "s"}
    </p>
  );
}

function Preview({ preview }: { preview: SessionPreview }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2 p-3 text-sm">
      {preview.errors.length > 0 && (
        <div>
          <p className="font-medium text-danger">
            Rejected — nothing will be written. {preview.errors.length} problem
            {preview.errors.length === 1 ? "" : "s"}:
          </p>
          <ul className="mt-1 flex list-inside list-disc flex-col gap-0.5 text-xs text-danger">
            {preview.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {(preview.batchId || preview.summary) && (
        <div>
          {preview.summary && <p className="font-medium">{preview.summary}</p>}
          {preview.batchId && (
            <p className="font-mono text-xs text-muted">{preview.batchId}</p>
          )}
          <div className="mt-1">
            <Counts preview={preview} />
          </div>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <ul className="flex list-inside list-disc flex-col gap-0.5 text-xs text-accent">
          {preview.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {preview.cardsAdded.length > 0 && (
        <Group title="New cards">
          {preview.cardsAdded.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <span className="font-medium">{c.englishPrompt}</span>
              <span>{c.roman}</span>
              <span className="font-gurmukhi text-muted">{c.gurmukhi}</span>
              <span className="text-xs text-muted">
                {frameLabel(c.frameTag)} · slot “{c.agreementSlot}”
              </span>
              {c.familyVariant && (
                <span className="text-xs text-muted">
                  Also said in the family: {c.familyVariant}
                </span>
              )}
              {c.standardRoman && (
                <span className="text-xs text-muted">
                  Standard Punjabi: {c.standardRoman}
                </span>
              )}
              {c.notes && <span className="text-xs text-muted">{c.notes}</span>}
            </li>
          ))}
        </Group>
      )}

      {preview.cardsUpdated.length > 0 && (
        <Group title="Card changes">
          {preview.cardsUpdated.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <span className="font-medium">{c.englishPrompt}</span>
              <span className="text-xs text-muted">{c.reason}</span>
              <ul className="flex flex-col gap-1">
                {c.changes.map((ch) => (
                  <Change key={ch.field} change={ch} />
                ))}
              </ul>
              {c.resetReview && (
                <span className="text-xs text-accent">
                  Schedule resets to box 1, due now. Review history is kept.
                </span>
              )}
            </li>
          ))}
        </Group>
      )}

      {preview.freezesUpdated.length > 0 && (
        <Group title="Freezes">
          {preview.freezesUpdated.map((f) => (
            <li key={f.id} className="flex flex-col gap-0.5">
              <span className="font-medium">{f.english}</span>
              <span className="text-xs">
                {BUCKETS.find((b) => b.bucket === f.bucket)?.label}
              </span>
              <span className="text-xs">
                {OUTCOME_LABELS[f.outcome]}
                {f.waitingOn && ` — waiting on ${frameLabel(f.waitingOn)}`}
              </span>
              {f.note && <span className="text-xs text-muted">{f.note}</span>}
              {f.cards.map((c) => (
                <span key={c.id} className="text-xs text-muted">
                  → {c.englishPrompt}
                </span>
              ))}
            </li>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="flex flex-col gap-3">{children}</ul>
    </div>
  );
}

function show(v: FieldChange["before"]): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function Change({ change }: { change: FieldChange }) {
  return (
    <li className="text-xs">
      <span className="text-muted">{change.field}: </span>
      <span className="text-danger line-through">{show(change.before)}</span>
      {" → "}
      <span className="text-success">{show(change.after)}</span>
    </li>
  );
}
