import Link from "next/link";
import { notFound } from "next/navigation";
import { REFERENCE_SECTIONS, findSection } from "@/content/reference";

/** Deep-linkable per section, e.g. /reference/frames. */
export function generateStaticParams() {
  return REFERENCE_SECTIONS.map((s) => ({ section: s.id }));
}

// Typed explicitly rather than with the generated `PageProps<"/reference/[section]">`
// helper, which only exists once a build has emitted route types — a fresh
// clone would fail `tsc` before its first build.
export default async function ReferenceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const found = findSection(section);
  if (!found) notFound();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Link
          href="/reference"
          className="text-xs text-muted underline hover:text-brand-strong"
        >
          ← All reference
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {found.title}
        </h1>
      </section>
      <div className="rounded-2xl border border-border bg-surface p-5">
        {found.body}
      </div>
    </div>
  );
}
