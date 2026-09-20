import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  countDueIgnoringDailyCap,
  countReviewedToday,
  getSessionPrefs,
  getStudySession,
} from "@/lib/study/server";
import { ReviewSession } from "@/components/review-session";
import { DayComplete } from "@/components/day-complete";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  // `?all=1` is the opt-out from the daily cap — a second session once today's
  // set is finished. Reading it makes this page dynamic, which it already was.
  const extra = (await searchParams).all === "1";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Production</h1>
        <p className="mt-1 text-sm text-muted">
          Read the English, say the whole sentence aloud, then flip.
        </p>
      </section>
      <StudyBody extra={extra} />
    </div>
  );
}

async function StudyBody({ extra }: { extra: boolean }) {
  if (!isSupabaseConfigured) {
    return (
      <Placeholder title="Connect Supabase first">
        Add your Supabase credentials (see SETUP.md) to start studying.
      </Placeholder>
    );
  }

  // Independent queries — fire them together rather than chaining awaits.
  const [prefs, queue, doneToday] = await Promise.all([
    getSessionPrefs(),
    getStudySession("production", { ignoreDailyCap: extra }),
    countReviewedToday("production"),
  ]);

  if (queue.length === 0) {
    // An empty queue means one of two quite different things: the day's budget
    // is spent, or nothing is actually waiting. Only the second is "come back
    // tomorrow", so find out which before saying anything.
    const waiting = await countDueIgnoringDailyCap("production");

    if (!extra && doneToday > 0 && waiting > 0) {
      return (
        <DayComplete
          mode="production"
          doneToday={doneToday}
          stillWaiting={waiting}
        />
      );
    }

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
      scriptMode={prefs.scriptMode}
      doneToday={extra ? 0 : doneToday}
      extra={extra}
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
