import { isSupabaseConfigured } from "@/lib/env";
import { getLearningLog } from "@/lib/log/server";
import { LOG_KINDS, type LogDay } from "@/lib/log/types";
import { LogEntry } from "@/components/log-entry";

export default async function LogPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Routine log</h1>
        <p className="mt-1 text-sm text-muted">
          What actually happened, not what was planned.
        </p>
      </section>
      <Body />
    </div>
  );
}

async function Body() {
  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
        Connect Supabase (see SETUP.md) to keep a log.
      </p>
    );
  }

  const log = await getLearningLog(28);

  return (
    <>
      <LogEntry today={log.today} days={log.days} />

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Last {log.totals.window} days
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Total label="Days with cards" value={log.totals.cardDays} />
          {LOG_KINDS.map((k) => (
            <Total key={k.kind} label={k.label} value={log.totals[k.kind]} />
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Day by day
        </h2>
        <ul className="flex flex-col">
          {log.days.map((d) => (
            <DayRow key={d.day} day={d} isToday={d.day === log.today} />
          ))}
        </ul>
      </section>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function DayRow({ day, isToday }: { day: LogDay; isToday: boolean }) {
  const date = new Date(`${day.day}T00:00:00Z`);
  const weekday = date.toLocaleDateString("en-AU", {
    timeZone: "UTC",
    weekday: "short",
  });
  const label = date.toLocaleDateString("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  const empty = day.reviews === 0 && day.kinds.length === 0;

  return (
    <li className="flex items-center gap-3 border-b border-border py-2 last:border-b-0 text-sm">
      <span
        className={`w-24 shrink-0 ${isToday ? "font-semibold text-brand-strong" : "text-muted"}`}
      >
        {weekday} {label}
      </span>

      <span className="flex flex-1 flex-wrap gap-1.5">
        {day.reviews > 0 && (
          <Chip tone="auto">{day.reviews} cards</Chip>
        )}
        {LOG_KINDS.filter((k) => day.kinds.includes(k.kind)).map((k) => (
          <Chip key={k.kind}>{k.label}</Chip>
        ))}
        {empty && <span className="text-xs text-muted">—</span>}
      </span>
    </li>
  );
}

function Chip({
  children,
  tone = "manual",
}: {
  children: React.ReactNode;
  tone?: "manual" | "auto";
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tone === "auto"
          ? "bg-accent/15 text-accent"
          : "bg-brand/15 text-brand-strong"
      }`}
    >
      {children}
    </span>
  );
}
