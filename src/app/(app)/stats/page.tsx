import { isSupabaseConfigured } from "@/lib/env";
import { getStats, type FrameRow, type StatsData } from "@/lib/stats/server";
import { frameLabel, frameRule } from "@/lib/frame-tags";
import { AgreementChart } from "@/components/agreement-chart";

export default async function StatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-muted">
          Is the agreement problem shrinking?
        </p>
      </section>
      <Body />
    </div>
  );
}

async function Body() {
  if (!isSupabaseConfigured) {
    return (
      <Empty title="Connect Supabase first">
        Add your credentials (see SETUP.md) to see your progress.
      </Empty>
    );
  }

  const stats = await getStats();

  if (stats.totalReviews === 0) {
    return (
      <Empty title="No reviews yet">
        Grade a few cards and this fills in. The headline number is the share of
        reviews where the words were right but the agreement was wrong.
      </Empty>
    );
  }

  return (
    <>
      <Headline stats={stats} />
      <FrameBreakdown frames={stats.frames} />
      <Leeches stats={stats} />
      <Secondary stats={stats} />
    </>
  );
}

/**
 * The headline number leads, because it is the one question the screen exists
 * to answer. The weekly line only appears once there are two points to join.
 */
function Headline({ stats }: { stats: StatsData }) {
  const rate = stats.totalAgreement / stats.totalReviews;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Agreement-fail rate
      </h2>

      <p className="mt-2 text-5xl font-bold tabular-nums text-accent">
        {Math.round(rate * 100)}%
      </p>
      <p className="mt-1 text-sm text-muted">
        {stats.totalAgreement} of {stats.totalReviews} reviews, all time
      </p>

      {stats.weeks.length > 1 ? (
        <div className="mt-5">
          <AgreementChart weeks={stats.weeks} />
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">
              Show as a table
            </summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 font-medium">Week of</th>
                  <th className="py-1 text-right font-medium">Reviews</th>
                  <th className="py-1 text-right font-medium">Agreement</th>
                  <th className="py-1 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {stats.weeks.map((w) => (
                  <tr key={w.weekStart} className="border-t border-border">
                    <td className="py-1">{w.weekStart}</td>
                    <td className="py-1 text-right">{w.total}</td>
                    <td className="py-1 text-right">{w.agreement}</td>
                    <td className="py-1 text-right">
                      {Math.round((w.agreement / Math.max(w.total, 1)) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          The week-by-week trend appears once you have reviews in more than one
          week.
        </p>
      )}
    </section>
  );
}

/** Which structure is unresolved. Worst first — that is the actionable order. */
function FrameBreakdown({ frames }: { frames: FrameRow[] }) {
  if (frames.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        By structure
      </h2>
      <ul className="flex flex-col gap-3.5">
        {frames.map((f) => (
          <li key={f.frameTag}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                {frameLabel(f.frameTag)}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {Math.round(f.rate * 100)}%{" "}
                <Trend recent={f.recentRate} prior={f.priorRate} />
              </span>
            </div>

            {/* magnitude bar: one hue, length is the encoding */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(f.rate * 100, 2)}%` }}
              />
            </div>

            <p className="mt-1 text-xs text-muted">
              {f.agreement} agreement {f.agreement === 1 ? "fail" : "fails"} in{" "}
              {f.total} {f.total === 1 ? "review" : "reviews"}
              {frameRule(f.frameTag) && <> · {frameRule(f.frameTag)}</>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Direction of travel. Never colour alone — arrow glyph plus a written label. */
function Trend({ recent, prior }: { recent: number; prior: number }) {
  if (recent < 0 || prior < 0) {
    return <span className="text-xs text-muted">· not enough history</span>;
  }
  const delta = recent - prior;
  if (Math.abs(delta) < 0.02) {
    return <span className="text-xs text-muted">· flat</span>;
  }
  const better = delta < 0;
  return (
    <span className={`text-xs ${better ? "text-success" : "text-danger"}`}>
      {better ? "↓" : "↑"} {better ? "improving" : "worsening"}
    </span>
  );
}

/** Cards that need re-teaching rather than more drilling. */
function Leeches({ stats }: { stats: StatsData }) {
  if (stats.leeches.length === 0) return null;

  return (
    <section className="rounded-2xl border border-danger/30 bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Needs re-teaching
      </h2>
      <p className="mt-1 mb-3 text-xs text-muted">
        Four or more agreement fails. Drilling these again is unlikely to help —
        the rule itself needs another look.
      </p>
      <ul className="flex flex-col gap-2.5">
        {stats.leeches.map((l) => (
          <li key={l.cardId} className="border-t border-border pt-2.5">
            <p className="text-sm font-medium">{l.englishPrompt}</p>
            <p className="text-xs text-muted">
              {l.roman} · {frameLabel(l.frameTag)} · {l.agreementFails} agreement
              fails
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Secondary, deliberately small: where the deck sits and what is coming. */
function Secondary({ stats }: { stats: StatsData }) {
  const maxBox = Math.max(...stats.boxes, 1);
  const maxDue = Math.max(...stats.forecast.map((f) => f.due), 1);

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Box distribution
        </h2>
        <ul className="flex flex-col gap-1.5">
          {stats.boxes.map((n, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-muted">Box {i + 1}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${(n / maxBox) * 100}%` }}
                />
              </span>
              <span className="w-5 shrink-0 text-right tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Due next 7 days
        </h2>
        {stats.forecast.length === 0 ? (
          <p className="text-xs text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stats.forecast.slice(0, 8).map((f) => (
              <li key={f.day} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted">
                  {f.day.slice(5)}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${(f.due / maxDue) * 100}%` }}
                  />
                </span>
                <span className="w-5 shrink-0 text-right tabular-nums">
                  {f.due}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Empty({
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
