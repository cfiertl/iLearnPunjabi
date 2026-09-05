import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-3xl shadow-sm">
            🗣️
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ILearnPunjabi</h1>
          <p className="mt-1 text-sm text-muted">
            Your personal path from A2 to fluency.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-lg border border-brand/40 bg-brand/10 p-3 text-sm">
            <p className="font-semibold text-brand-strong">
              Supabase not connected yet
            </p>
            <p className="mt-1 text-muted">
              Add your credentials to <code>.env.local</code> and restart to
              enable sign-in.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <LoginForm configured={isSupabaseConfigured} />
        </div>
      </div>
    </main>
  );
}
