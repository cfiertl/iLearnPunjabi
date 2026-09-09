import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Bucket, Freeze } from "@/lib/freezes/types";

type Row = {
  id: string;
  english: string;
  captured_at: string;
  bucket: Bucket | null;
  note: string | null;
  resolved: boolean;
};

function toFreeze(row: Row, cardIds: string[] = []): Freeze {
  return {
    id: row.id,
    english: row.english,
    capturedAt: row.captured_at,
    bucket: row.bucket,
    note: row.note,
    resolved: row.resolved,
    cardIds,
  };
}

/** How many freezes are waiting to be triaged — for the capture button badge. */
export async function countUntriaged(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("count_untriaged_freezes");
  return typeof data === "number" ? data : 0;
}

export type FreezeLists = {
  untriaged: Freeze[];
  triaged: Freeze[];
};

/**
 * Untriaged oldest-first (the triage queue), and everything else newest-first.
 * Both come back in one round trip.
 */
export async function getFreezes(): Promise<FreezeLists> {
  const supabase = await createClient();

  const [allRes, cardRes] = await Promise.all([
    supabase
      .from("freezes")
      .select("id, english, captured_at, bucket, note, resolved")
      .order("captured_at", { ascending: false }),
    supabase.from("cards").select("id, freeze_id").not("freeze_id", "is", null),
  ]);

  const cardsByFreeze = new Map<string, string[]>();
  for (const c of (cardRes.data ?? []) as {
    id: string;
    freeze_id: string;
  }[]) {
    const list = cardsByFreeze.get(c.freeze_id) ?? [];
    list.push(c.id);
    cardsByFreeze.set(c.freeze_id, list);
  }

  const rows = (allRes.data ?? []) as Row[];
  const untriaged = rows
    .filter((r) => r.bucket === null && !r.resolved)
    .map((r) => toFreeze(r, cardsByFreeze.get(r.id) ?? []))
    // Oldest first: the queue is worked front to back.
    .reverse();

  const triaged = rows
    .filter((r) => r.bucket !== null || r.resolved)
    .map((r) => toFreeze(r, cardsByFreeze.get(r.id) ?? []));

  return { untriaged, triaged };
}
