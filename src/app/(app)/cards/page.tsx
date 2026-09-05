import { isSupabaseConfigured } from "@/lib/env";
import { getDashboardStats, getSessionPrefs } from "@/lib/study/server";
import { CardManager } from "@/components/card-manager";
import { FRAME_TAGS } from "@/lib/frame-tags";

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

  const prefs = await getSessionPrefs();
  const stats = await getDashboardStats(prefs);
  return <CardManager cardCount={stats.cardCount} />;
}

/** The tag -> rule table, so the vocabulary for `frameTag` is discoverable. */
function FrameReference() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Frame tags
      </h2>
      <dl className="flex flex-col gap-2.5 text-sm">
        {Object.entries(FRAME_TAGS).map(([tag, rule]) => (
          <div key={tag}>
            <dt className="font-mono text-xs text-brand-strong">{tag}</dt>
            <dd className="text-muted">{rule}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">
        Other tags are accepted on import — they just come through without a
        rule reminder.
      </p>
    </section>
  );
}
