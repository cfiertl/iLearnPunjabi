import Link from "next/link";
import { getGurmukhiStats } from "@/lib/gurmukhi/server";
import type { GurmukhiStats } from "@/lib/gurmukhi/stats";

const SLOWEST_SHOWN = 15;
const CONFUSIONS_SHOWN = 15;
const TREND_SHOWN = 14;

/**
 * The Gurmukhi drill's own statistics. Kept apart from the card statistics:
 * nothing here feeds, or is fed by, the agreement-fail rate.
 */
export async function GurmukhiStatsSection() {
  const stats = await getGurmukhiStats();
  if (!stats) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Gurmukhi</h2>
        <p className="mt-0.5 text-sm text-muted">
          Which wrong reading gets picked, and how long reading takes.
        </p>
      </div>

      {stats.totalAttempts === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
          No drill attempts yet.{" "}
          <Link href="/study/gurmukhi" className="text-brand-strong underline">
            Start a drill
          </Link>
          .
        </div>
      ) : (
        <>
          <Slowest stats={stats} />
          <Confusions stats={stats} />
          <Candidates stats={stats} />
          <SetAccuracyList stats={stats} />
          <Trend stats={stats} />
          <p className="text-xs text-muted">
            <Pending /> awaiting family check: the reading may be tone rather than aspiration.
          </p>
        </>
      )}
    </section>
  );
}

const CARD = "rounded-2xl border border-border bg-surface p-5";
const H3 = "mb-3 text-sm font-semibold uppercase tracking-wide text-muted";

function secs(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function Pending() {
  return (
    <span title="Awaiting family check" className="text-accent">
      ◆
    </span>
  );
}

function G({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <span lang="pa" className={`font-gurmukhi ${big ? "text-2xl" : "text-lg"}`}>
      {children}
    </span>
  );
}

/** The headline: the grid is covered once lookups are fast. */
function Slowest({ stats }: { stats: GurmukhiStats }) {
  const rows = stats.slowest.slice(0, SLOWEST_SHOWN);
  const max = Math.max(...rows.map((r) => r.medianMs), 1);
  return (
    <div className={CARD}>
      <h3 className={H3}>Slowest items</h3>
      <p className="-mt-2 mb-3 text-xs text-muted">Median reading time over the last 10 attempts.</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.itemId} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate">
              <G>{r.shown}</G> <span className="text-muted">{r.label}</span>{" "}
              {r.pending && <Pending />}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(r.medianMs / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums">{secs(r.medianMs)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Confusions({ stats }: { stats: GurmukhiStats }) {
  if (stats.confusions.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className={H3}>Confusions</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {stats.confusions.slice(0, CONFUSIONS_SHOWN).map((c) => (
          <li
            key={`${c.shown}-${c.pickedShown ?? c.pickedLabel}`}
            className="flex items-center justify-between gap-3"
          >
            <span>
              <G>{c.shown}</G> <span className="text-muted">read as</span>{" "}
              {c.pickedShown && <G>{c.pickedShown}</G>} {c.pickedLabel}{" "}
              {c.pending && <Pending />}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
              {c.inKnownSet === null ? "" : c.inKnownSet ? "known set" : "not in a set"}
              <span className="tabular-nums text-foreground">×{c.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Display only: a pair becomes a set through a session import. */
function Candidates({ stats }: { stats: GurmukhiStats }) {
  if (stats.candidates.length === 0) return null;
  return (
    <div className={`${CARD} border-accent/30`}>
      <h3 className={H3}>Candidate pairs</h3>
      <p className="-mt-2 mb-3 text-xs text-muted">
        Confused 3 or more times but not in any confusable set. Add them in a session file.
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {stats.candidates.map((p) => (
          <li key={`${p.a}-${p.b}`} className="flex justify-between gap-3">
            <span>
              <G big>{p.a}</G> <span className="text-muted">vs</span> <G big>{p.b}</G>{" "}
              {p.pending && <Pending />}
            </span>
            <span className="tabular-nums">×{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SetAccuracyList({ stats }: { stats: GurmukhiStats }) {
  const rows = stats.setAccuracy.filter((s) => s.attempts > 0);
  if (rows.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className={H3}>Accuracy by set</h3>
      <ul className="flex flex-col gap-3">
        {rows.map((s) => {
          const rate = s.correct / s.attempts;
          return (
            <li key={s.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <G>{s.chars.join(" ")}</G>{" "}
                  <span className="text-xs text-muted">{s.description}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{Math.round(rate * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${Math.max(rate * 100, 2)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {s.correct} of {s.attempts} attempts
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Trend({ stats }: { stats: GurmukhiStats }) {
  const rows = stats.trend.slice(-TREND_SHOWN);
  const max = Math.max(...rows.map((r) => r.medianMs), 1);
  return (
    <div className={CARD}>
      <h3 className={H3}>Reading time by session</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.sessionId} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted">{r.startedAt.slice(5, 10)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${(r.medianMs / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums">{secs(r.medianMs)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
