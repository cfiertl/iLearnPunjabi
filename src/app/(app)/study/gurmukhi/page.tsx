import { isSupabaseConfigured } from "@/lib/env";
import { getDrillData } from "@/lib/gurmukhi/server";
import { GurmukhiDrill } from "@/components/gurmukhi-drill";

export default async function GurmukhiPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Gurmukhi</h1>
        <p className="mt-1 text-sm text-muted">
          Read it aloud, then pick what you said.
        </p>
      </section>
      <Body />
    </div>
  );
}

async function Body() {
  if (!isSupabaseConfigured) {
    return (
      <Placeholder title="Connect Supabase first">
        Add your Supabase credentials (see SETUP.md) to start drilling.
      </Placeholder>
    );
  }

  const data = await getDrillData();
  if (!data) {
    return (
      <Placeholder title="Not set up yet">
        Run migration <code className="text-brand-strong">0011_gurmukhi_drill.sql</code>{" "}
        (see SETUP.md), then reload.
      </Placeholder>
    );
  }

  return (
    <GurmukhiDrill
      content={data.content}
      serverHistory={data.history}
      palmHint={data.palmHint}
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
