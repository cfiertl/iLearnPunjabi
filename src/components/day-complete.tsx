import Link from "next/link";
import type { ReviewMode } from "@/lib/leitner";

/**
 * Shown when the queue is empty because today's budget is spent, not because
 * nothing is waiting.
 *
 * The distinction is the point: the cap is a daily set that can be finished in
 * as many sittings as it takes, so a spent budget has to read as "done", never
 * as "nothing due". The backlog is stated plainly and there is a way past the
 * cap — it is a floor under the habit, not a lockout.
 */
export function DayComplete({
  mode,
  doneToday,
  stillWaiting,
}: {
  mode: ReviewMode;
  doneToday: number;
  stillWaiting: number;
}) {
  const href = mode === "cloze" ? "/study/cloze?all=1" : "/study?all=1";

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-bold">Today&rsquo;s set is done</p>
      <p className="max-w-xs text-sm text-muted">
        {doneToday} reviewed today — that is the whole day&rsquo;s set, however
        many sittings it took. {stillWaiting} still waiting; they keep until
        tomorrow.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong"
      >
        Back to home
      </Link>
      <Link
        href={href}
        className="text-xs text-muted underline underline-offset-2 hover:text-brand-strong"
      >
        Keep going anyway
      </Link>
    </div>
  );
}
