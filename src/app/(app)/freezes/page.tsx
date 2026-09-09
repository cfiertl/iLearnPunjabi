import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getFreezes } from "@/lib/freezes/server";
import { FreezeCapture } from "@/components/freeze-capture";
import { FreezeTriage } from "@/components/freeze-triage";

/** ?tab=triage shows the queue; capture is the default, because speed matters. */
export default async function FreezesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const triageTab = tab === "triage";

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Freezes</h1>
        <p className="mt-1 text-sm text-muted">
          What you wanted to say and couldn&apos;t.
        </p>
      </section>

      <Body triageTab={triageTab} />
    </div>
  );
}

async function Body({ triageTab }: { triageTab: boolean }) {
  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-muted">
        Connect Supabase (see SETUP.md) to capture freezes.
      </p>
    );
  }

  const { untriaged, triaged } = await getFreezes();

  return (
    <>
      <nav className="flex gap-1.5">
        <Tab href="/freezes" active={!triageTab}>
          Capture
        </Tab>
        <Tab href="/freezes?tab=triage" active={triageTab}>
          Triage
          {untriaged.length > 0 && (
            <span className="ml-1.5 rounded-full bg-brand px-1.5 text-xs text-brand-contrast">
              {untriaged.length}
            </span>
          )}
        </Tab>
      </nav>

      {triageTab ? (
        <FreezeTriage untriaged={untriaged} triaged={triaged} />
      ) : (
        <FreezeCapture />
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand/15 text-brand-strong"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
