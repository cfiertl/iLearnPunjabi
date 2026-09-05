"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  exportAll,
  previewImport,
  runImport,
  seedDummyCards,
  type ImportPreview,
} from "@/app/(app)/cards/actions";

export function CardManager({ cardCount }: { cardCount: number }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<null | "check" | "import" | "seed" | "export">(null);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setPreview(null);
    setResult(null);
  }

  async function check() {
    setBusy("check");
    setResult(null);
    setPreview(await previewImport(raw));
    setBusy(null);
  }

  async function doImport() {
    setBusy("import");
    try {
      const r = await runImport(raw);
      setResult(
        `Added ${r.added} card${r.added === 1 ? "" : "s"}` +
          (r.skipped ? `, skipped ${r.skipped} already present.` : "."),
      );
      setRaw("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Import failed.");
    }
    setBusy(null);
  }

  async function seed() {
    setBusy("seed");
    try {
      const r = await seedDummyCards();
      setResult(
        r.added
          ? `Added ${r.added} dummy sentence cards.`
          : "The dummy cards are already loaded.",
      );
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not load the seed batch.");
    }
    setBusy(null);
  }

  async function download() {
    setBusy("export");
    try {
      const json = await exportAll();
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `punjabi-srs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Export failed.");
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Import */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Import
        </h2>
        <p className="text-sm text-muted">
          Paste or upload a JSON array of cards. Re-importing the same batch
          will not duplicate anything.
        </p>

        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPreview(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />

        {preview && <PreviewPanel preview={preview} />}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={check}
            disabled={!raw.trim() || busy !== null}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-brand disabled:opacity-50"
          >
            {busy === "check" ? "Checking…" : "Validate"}
          </button>
          <button
            onClick={doImport}
            disabled={!preview?.toAdd || busy !== null}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
          >
            {busy === "import"
              ? "Importing…"
              : preview
                ? `Import ${preview.toAdd}`
                : "Import"}
          </button>
        </div>
      </section>

      {/* Export */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Export
        </h2>
        <p className="text-sm text-muted">
          Every card, schedule, and review event as pretty-printed JSON — ready
          to paste into a tutoring conversation. Audio files are not included.
        </p>
        <button
          onClick={download}
          disabled={busy !== null}
          className="self-start rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-brand disabled:opacity-50"
        >
          {busy === "export" ? "Preparing…" : "Download JSON"}
        </button>
      </section>

      {/* Seed */}
      {cardCount === 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-surface-2 p-5">
          <h2 className="text-sm font-semibold">No sentences yet</h2>
          <p className="text-sm text-muted">
            Load 4 dummy cards to exercise the review loop before importing a
            real batch.
          </p>
          <button
            onClick={seed}
            disabled={busy !== null}
            className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
          >
            {busy === "seed" ? "Loading…" : "Load seed batch"}
          </button>
        </section>
      )}

      {result && <p className="text-sm text-brand-strong">{result}</p>}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: ImportPreview }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <p>
        <strong>{preview.total}</strong> card
        {preview.total === 1 ? "" : "s"} parsed ·{" "}
        <strong>{preview.toAdd}</strong> new ·{" "}
        <strong>{preview.duplicates}</strong> already present
      </p>

      {preview.unknownTags.length > 0 && (
        <p className="text-xs text-muted">
          Unrecognised frame tags (imported anyway):{" "}
          <span className="font-mono">{preview.unknownTags.join(", ")}</span>
        </p>
      )}

      {preview.errors.length > 0 && (
        <ul className="flex list-inside list-disc flex-col gap-0.5 text-xs text-danger">
          {preview.errors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {preview.errors.length > 8 && (
            <li>…and {preview.errors.length - 8} more.</li>
          )}
        </ul>
      )}
    </div>
  );
}

const PLACEHOLDER = `[
  {
    "englishPrompt": "I ate roti yesterday",
    "gurmukhi": "…",
    "roman": "main kal roti khadhi",
    "frameTag": "perfective_object_agr",
    "agreementSlot": "khadhi",
    "slotIndexRoman": 3,
    "slotIndexGurmukhi": 3,
    "notes": "roti is feminine"
  }
]`;
