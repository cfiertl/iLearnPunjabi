import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/auth";
import { getSessionPrefs } from "@/lib/study/server";
import { signOut } from "@/app/actions/auth";
import { updateSettings } from "./actions";

export default async function SettingsPage() {
  if (!isSupabaseConfigured) {
    return (
      <Wrap>
        <p className="text-sm text-muted">
          Connect Supabase (see SETUP.md) to manage settings.
        </p>
      </Wrap>
    );
  }

  const user = await getUser();
  const prefs = await getSessionPrefs();

  return (
    <Wrap>
      <form
        action={updateSettings}
        className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Session
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Reviews per session</span>
          <input
            name="session_cap"
            type="number"
            min={1}
            step={1}
            defaultValue={prefs.sessionCap}
            className="w-28 rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">New cards per day</span>
          <input
            name="new_per_day"
            type="number"
            min={0}
            step={1}
            defaultValue={prefs.newPerDay}
            className="w-28 rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <label className="flex items-start gap-3">
          <input
            name="flip_friction"
            type="checkbox"
            defaultChecked={prefs.flipDelayMs > 0}
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
          />
          <span>
            <span className="text-sm font-medium">Pause before flipping</span>
            <span className="block text-xs text-muted">
              Holds the Flip button for a moment so checking the answer cannot
              replace attempting the sentence. On by default.
            </span>
          </span>
        </label>

        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong"
        >
          Save
        </button>
      </form>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Account
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{user?.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </section>
      {children}
    </div>
  );
}
