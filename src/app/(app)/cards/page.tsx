import { isSupabaseConfigured } from "@/lib/env";
import { getDashboardStats } from "@/lib/study/server";
import { CardManager } from "@/components/card-manager";
import Link from "next/link";
import { KNOWN_FRAME_TAGS } from "@/lib/frame-tags";

export default async function CardsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
        <p className="mt-1 text-sm text-muted">
          Import sentences, export everything.
        </p>
      </section>
      <Body />
      <FrameReference />
    </div>
  );
}

async function Body() {
  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
        Connect Supabase (see SETUP.md) to manage cards.
      </p>
    );
  }

  const stats = await getDashboardStats();
  return <CardManager cardCount={stats.cardCount} />;
}

/**
 * The tag vocabulary lives in the reference section now — one page owns it, so
 * this one links rather than keeping a second copy that can drift.
 */
function FrameReference() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        Frame tags
      </h2>
      <p className="text-sm text-muted">
        {KNOWN_FRAME_TAGS.length} recognised tags, each with its agreement rule,
        are listed in the{" "}
        <Link
          href="/reference/frames"
          className="text-brand-strong underline"
        >
          frame reference
        </Link>
        . Other tags are accepted on import — they just come through without a
        rule reminder.
      </p>
    </section>
  );
}
