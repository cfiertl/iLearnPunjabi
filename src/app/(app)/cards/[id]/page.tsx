import Link from "next/link";
import { notFound } from "next/navigation";
import { getCard } from "@/lib/cards/server";
import { CardEditor } from "@/components/card-editor";

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

      {/* The freeze this card came from, where there is one. Display-only. */}
      {card.freeze && (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            From a freeze
          </p>
          <p className="mt-1 text-sm">{card.freeze.english}</p>
          <Link
            href="/freezes?tab=triage"
            className="mt-1 inline-block text-xs text-muted underline hover:text-brand-strong"
          >
            Freezes
          </Link>
        </section>
      )}

      <CardEditor card={card} />
    </div>
  );
}
