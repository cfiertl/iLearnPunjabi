import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getDashboardStats, getSessionPrefs } from "@/lib/study/server";

export default async function HomePage() {
  const prefs = isSupabaseConfigured ? await getSessionPrefs() : null;
  const stats = prefs ? await getDashboardStats(prefs) : null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Sentence practice</h1>
        <p className="mt-1 text-sm text-muted">
          Production drill with agreement instrumentation.
        </p>
      </section>

      {!isSupabaseConfigured && <SetupBanner />}

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Due now"
          value={String(stats?.dueProduction ?? 0)}
          hint={
            !stats?.cardCount
              ? "No sentences yet"
              : stats.dueProduction
                ? "Ready when you are"
                : "Nothing waiting"
          }
        />
        <StatCard
          label="Sentence bank"
          value={String(stats?.cardCount ?? 0)}
          hint="Active cards"
        />
      </section>

      <section className="flex flex-col gap-3">
        <ActionCard
          href="/study"
          title="Production"
          subtitle="English prompt in, full sentence out"
        />
        <ActionCard
          href="/cards"
          title="Cards"
          subtitle="Import a batch, or export everything as JSON"
        />
      </section>
    </div>
  );
}

function SetupBanner() {
  return (
    <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
      <p className="font-semibold text-brand-strong">Finish setup</p>
      <p className="mt-1 text-muted">
        Connect a Supabase project (see <code>SETUP.md</code>) to enable login
        and saving your progress.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function ActionCard({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-brand hover:shadow-sm">
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <span className="text-muted">›</span>
      </div>
    </Link>
  );
}
