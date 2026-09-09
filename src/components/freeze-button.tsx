import Link from "next/link";

/**
 * One tap from anywhere. Floating rather than a nav item because the bottom bar
 * is full, and because a freeze needs capturing the moment it happens —
 * including from the middle of a review.
 *
 * Deliberately does NOT fetch an untriaged count. Any query here would run on
 * every page render and would force the whole (app) layout to be dynamic,
 * un-prerendering the reference pages. The badge lives on the Triage tab
 * inside /freezes, where the number is already loaded.
 */
export function FreezeButton() {
  return (
    <Link
      href="/freezes"
      aria-label="Capture a freeze"
      className="fixed bottom-20 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
    >
      <span className="text-lg leading-none">+</span>
      Freeze
    </Link>
  );
}
