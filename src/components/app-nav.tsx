"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/study", label: "Study" },
  { href: "/cards", label: "Cards" },
  { href: "/stats", label: "Progress" },
  { href: "/reference", label: "Reference" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition ${
                  active ? "text-brand" : "text-muted hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
