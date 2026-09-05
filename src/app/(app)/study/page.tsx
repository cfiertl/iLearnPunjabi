import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getReviewQueue, getSessionPrefs } from "@/lib/study/server";
import { ReviewSession } from "@/components/review-session";

export default async function StudyPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Production</h1>
        <p className="mt-1 text-sm text-muted">
          Read the English, say the whole sentence aloud, then flip.
        </p>
      </section>
      <StudyBody />
    </div>
  );
}

async function StudyBody() {
  if (!isSupabaseConfigured) {
    return (
      <Placeholder title="Connect Supabase first">
        Add your Supabase credentials (see SETUP.md) to start studying.
      </Placeholder>
    );
  }

  const prefs = await getSessionPrefs();
  const queue = await getReviewQueue("production", prefs);

  if (queue.length === 0) {
    return (
      <Placeholder title="Nothing due">
        No sentences are waiting right now.{" "}
        <Link href="/cards" className="text-brand-strong underline">
          Import a batch
        </Link>{" "}
        or come back tomorrow.
      </Placeholder>
    );
  }

  return (
    <ReviewSession
      initialQueue={queue}
      mode="production"
      flipDelayMs={prefs.flipDelayMs}
    />
  );
}

function Placeholder({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{children}</p>
    </div>
  );
}
