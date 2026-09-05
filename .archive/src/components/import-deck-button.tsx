"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importStarterDeck } from "@/app/(app)/study/actions";

export function ImportDeckButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      await importStarterDeck();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add starter deck"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
