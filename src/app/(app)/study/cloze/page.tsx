import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  countDueIgnoringDailyCap,
  countReviewedToday,
  getSessionPrefs,
  getStudySession,
} from "@/lib/study/server";
import { isClozeable } from "@/lib/study/types";
import { ReviewSession } from "@/components/review-session";
import { DayComplete } from "@/components/day-complete";

export default async function ClozePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const extra = (await searchParams).all === "1";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Cloze</h1>
        <p className="mt-1 text-sm text-muted">
          The agreement slot is blanked out.
        </p>
      </section>
      <ClozeBody extra={extra} />
    </div>
  );
}

async function ClozeBody({ extra }: { extra: boolean }) {
  if (!isSupabaseConfigured) {
    return (
      <Placeholder title="Connect Supabase first">
        Add your Supabase credentials (see SETUP.md) to start studying.
      </Placeholder>
    );
  }

  const [prefs, all, doneToday] = await Promise.all([
    getSessionPrefs(),
    getStudySession("cloze", { ignoreDailyCap: extra }),
    countReviewedToday("cloze"),
  ]);

  // Drop cards whose slot cannot be located in the script being blanked —
  // otherwise the front would print the answer it is meant to hide.
  const queue = all.filter((c) => isClozeable(c, prefs.scriptMode));

  if (queue.length === 0) {
    // Today's budget spent is a different state from nothing waiting.
    const waiting = await countDueIgnoringDailyCap("cloze");

    if (!extra && doneToday > 0 && waiting > 0) {
      return (
        <DayComplete mode="cloze" doneToday={doneToday} stillWaiting={waiting} />
      );
    }

    return (
      <Placeholder title="Nothing due">
        Cloze only covers cards with an agreement slot under test. Add{" "}
        <code className="text-brand-strong">agreementSlot</code> to more cards
        on the{" "}
        <Link href="/cards" className="text-brand-strong underline">
          Cards
        </Link>{" "}
        page, or come back tomorrow.
      </Placeholder>
    );
  }

  return (
    <ReviewSession
      initialQueue={queue}
      mode="cloze"
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
