import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionPrefs, getStudySession } from "@/lib/study/server";
import { ReviewSession } from "@/components/review-session";

export default async function ClozePage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Cloze</h1>
        <p className="mt-1 text-sm text-muted">
          The agreement slot is blanked out.
        </p>
      </section>
      <ClozeBody />
    </div>
  );
}

async function ClozeBody() {
  if (!isSupabaseConfigured) {
    return (
      <Placeholder title="Connect Supabase first">
        Add your Supabase credentials (see SETUP.md) to start studying.
      </Placeholder>
    );
  }

  const [prefs, queue] = await Promise.all([
    getSessionPrefs(),
    getStudySession("cloze"),
  ]);

  if (queue.length === 0) {
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
