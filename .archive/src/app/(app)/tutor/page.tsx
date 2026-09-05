import { isSupabaseConfigured } from "@/lib/env";
import { isTutorConfigured } from "@/lib/anthropic";
import { TutorChat } from "@/components/tutor-chat";

export default function TutorPage() {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">AI Tutor</h1>
        <p className="mt-1 text-sm text-muted">
          Ask about grammar, sentence structure, or how to say anything.
        </p>
      </section>

      {!isSupabaseConfigured ? (
        <Notice>Connect Supabase (see SETUP.md) to use the tutor.</Notice>
      ) : !isTutorConfigured ? (
        <Notice>
          Add an <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> and
          restart to switch the tutor on. Usage is metered on your Settings page.
        </Notice>
      ) : (
        <TutorChat />
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm text-muted">
      {children}
    </div>
  );
}
