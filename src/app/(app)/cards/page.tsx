import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getDashboardStats } from "@/lib/study/server";
import { listCards, type CardSummary } from "@/lib/cards/server";
import { CardManager } from "@/components/card-manager";
import { KNOWN_FRAME_TAGS, frameLabel } from "@/lib/frame-tags";

/** ?tab=io shows import/export; the list is the default, being the daily use. */
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const io = tab === "io";

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
        <p className="mt-1 text-sm text-muted">
          Edit what the family corrects, retire what stops earning its place.
        </p>
      </section>
      <Body io={io} />
    </div>
  );
}

async function Body({ io }: { io: boolean }) {
  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
        Connect Supabase (see SETUP.md) to manage cards.
      </p>
    );
  }

  const [cards, stats] = await Promise.all([listCards(), getDashboardStats()]);

  return (
    <>
      <nav className="flex gap-1.5">
        <Tab href="/cards" active={!io}>
          All ({cards.length})
        </Tab>
        <Tab href="/cards?tab=io" active={io}>
          Import / Export
        </Tab>
      </nav>

      {io ? (
        <>
          <CardManager cardCount={stats.cardCount} />
          <FrameReference />
        </>
      ) : (
        <CardList cards={cards} />
      )}
    </>
  );
}

function CardList({ cards }: { cards: CardSummary[] }) {
  if (cards.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-muted">
        No cards yet.{" "}
        <Link href="/cards?tab=io" className="text-brand-strong underline">
          Import a batch
        </Link>
        .
      </p>
    );
  }

  const active = cards.filter((c) => c.active);
  const retired = cards.filter((c) => !c.active);

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col rounded-2xl border border-border bg-surface">
        {active.map((c) => (
          <Row key={c.id} card={c} />
        ))}
      </ul>

      {retired.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Retired ({retired.length})
          </h2>
          <ul className="flex flex-col rounded-2xl border border-border bg-surface opacity-60">
            {retired.map((c) => (
              <Row key={c.id} card={c} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ card }: { card: CardSummary }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/cards/${card.id}`}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {card.englishPrompt}
          </span>
          <span className="block truncate text-xs text-muted">
            {card.roman}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
            {card.frameTag && <span>{frameLabel(card.frameTag)}</span>}
            {card.familyVariant && (
              <span className="text-accent">family form</span>
            )}
            {!card.verified && <span>unverified</span>}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {card.box ? `Box ${card.box}` : "new"}
        </span>
        <span className="shrink-0 text-muted">›</span>
      </Link>
    </li>
  );
}

/** The tag vocabulary lives in the reference section; this links rather than copies. */
function FrameReference() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        Frame tags
      </h2>
      <p className="text-sm text-muted">
        {KNOWN_FRAME_TAGS.length} recognised tags, each with its agreement rule,
        are listed in the{" "}
        <Link href="/reference/frames" className="text-brand-strong underline">
          frame reference
        </Link>
        . Other tags are accepted on import — they just come through without a
        rule reminder.
      </p>
    </section>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand/15 text-brand-strong" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
