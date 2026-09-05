import { ReferenceBrowser } from "@/components/reference-browser";

export default function ReferencePage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Reference</h1>
        <p className="mt-1 text-sm text-muted">
          Routine, rules, and what to bring to a session.
        </p>
      </section>
      <ReferenceBrowser />
    </div>
  );
}
