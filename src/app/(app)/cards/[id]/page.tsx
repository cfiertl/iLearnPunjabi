import Link from "next/link";
import { notFound } from "next/navigation";
import { getCard } from "@/lib/cards/server";
import { frameLabel } from "@/lib/frame-tags";
import { tokenize } from "@/lib/study/types";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <Link
          href="/cards"
          className="text-xs text-muted underline hover:text-brand-strong"
        >
          ← All cards
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          {card.englishPrompt}
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
          <span>{card.box ? `Box ${card.box}` : "Not yet reviewed"}</span>
          {!card.active && <span className="text-danger">Retired</span>}
          {!card.verified && <span>Spelling unverified</span>}
        </p>
      </section>

      {/* The freezes this card answers, where there are any. Display-only. */}
      {card.freezes.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            {card.freezes.length === 1 ? "From a freeze" : "From freezes"}
          </p>
          {card.freezes.map((f) => (
            <p key={f.id} className="mt-1 text-sm">
              {f.english}
            </p>
          ))}
          <Link
            href="/freezes?tab=triage"
            className="mt-1 inline-block text-xs text-muted underline hover:text-brand-strong"
          >
            Freezes
          </Link>
        </section>
      )}

      {/* Read-only. Corrections go through a session file, so every change
          is visible in the next export and nothing drifts from what was agreed. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <Field label="Say">
          <Sentence text={card.roman} slot={card.slotIndexRoman} />
        </Field>
        <Field label="Gurmukhi">
          <span className="font-gurmukhi text-lg">
            <Sentence text={card.gurmukhi} slot={card.slotIndexGurmukhi} />
          </span>
        </Field>
        {card.familyVariant && (
          <Field label="Also said in the family">{card.familyVariant}</Field>
        )}
        {card.standardRoman && (
          <Field label="Standard Punjabi">{card.standardRoman}</Field>
        )}
        <Field label="Frame">
          {card.frameTag ? frameLabel(card.frameTag) : "—"}
          {card.agreementSlot && (
            <span className="text-muted"> · slot “{card.agreementSlot}”</span>
          )}
        </Field>
        {card.notes && <Field label="Notes">{card.notes}</Field>}
        <Field label="Last changed by">
          <span className="font-mono text-xs">{card.batchId ?? "—"}</span>
        </Field>
        <Field label="Card id">
          <span className="break-all font-mono text-xs">{card.id}</span>
        </Field>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

/** The sentence with its agreement slot underlined, where the index resolves. */
function Sentence({ text, slot }: { text: string; slot: number | null }) {
  if (!text) return <>—</>;
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i}>
          {i > 0 && " "}
          {i === slot ? (
            <span className="underline decoration-accent decoration-2 underline-offset-4">
              {t}
            </span>
          ) : (
            t
          )}
        </span>
      ))}
    </>
  );
}
