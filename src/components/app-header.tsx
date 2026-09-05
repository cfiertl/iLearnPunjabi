import Link from "next/link";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-lg">
            🗣️
          </span>
          <span className="font-bold tracking-tight">ILearnPunjabi</span>
        </div>
        {email && (
          <Link
            href="/settings"
            aria-label="Settings"
            className="text-lg text-muted hover:text-foreground"
          >
            ⚙️
          </Link>
        )}
      </div>
    </header>
  );
}
