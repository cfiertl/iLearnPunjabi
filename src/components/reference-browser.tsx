"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { REFERENCE_SECTIONS, sectionText } from "@/content/reference";

// Search index built once at module load. `sectionText` walks the rendered
// tree, so the index is always exactly what is on screen.
const INDEX = REFERENCE_SECTIONS.map((s) => ({
  id: s.id,
  haystack: `${s.title} ${sectionText(s.body)}`.toLowerCase(),
}));

export function ReferenceBrowser() {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null; // null = not searching, show everything collapsed
    return new Set(
      INDEX.filter((s) => s.haystack.includes(q)).map((s) => s.id),
    );
  }, [query]);

  const visible = REFERENCE_SECTIONS.filter(
    (s) => matches === null || matches.has(s.id),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the reference…"
          aria-label="Search the reference"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        {matches !== null && (
          <p className="mt-1.5 text-xs text-muted" aria-live="polite">
            {visible.length === 0
              ? "No sections match."
              : `${visible.length} of ${REFERENCE_SECTIONS.length} sections`}
          </p>
        )}
      </div>

      {visible.map((s) => (
        <details
          // Remounting on search state means hits open automatically, and
          // clearing the box collapses everything back down.
          key={`${s.id}-${matches === null ? "browse" : "search"}`}
          open={matches !== null}
          className="rounded-2xl border border-border bg-surface px-5 py-4"
        >
          <summary className="cursor-pointer list-none font-semibold marker:content-none">
            <span className="flex items-center justify-between gap-3">
              {s.title}
              <Link
                href={`/reference/${s.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-normal text-muted underline hover:text-brand-strong"
              >
                open
              </Link>
            </span>
          </summary>
          <div className="mt-4">{s.body}</div>
        </details>
      ))}
    </div>
  );
}
