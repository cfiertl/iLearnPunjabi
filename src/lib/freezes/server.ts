import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Bucket, Freeze, Outcome } from "@/lib/freezes/types";

type Row = {
  id: string;
  english: string;
  captured_at: string;
  bucket: Bucket | null;
  outcome: Outcome | null;
  waiting_on: string | null;
  note: string | null;
  resolved: boolean;
};

type CardLink = { id: string; englishPrompt: string };

function toFreeze(row: Row, cards: CardLink[] = []): Freeze {
  return {
    id: row.id,
    english: row.english,
    capturedAt: row.captured_at,
    bucket: row.bucket,
    outcome: row.outcome,
    waitingOn: row.waiting_on,
    note: row.note,
    resolved: row.resolved,
    cards,
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
 * Untriaged means no outcome yet: only a session import sets one.
 */
export async function getFreezes(): Promise<FreezeLists> {
  const supabase = await createClient();

  const [allRes, linkRes] = await Promise.all([
    supabase
      .from("freezes")
      .select("id, english, captured_at, bucket, outcome, waiting_on, note, resolved")
      .order("captured_at", { ascending: false }),
    supabase.from("freeze_cards").select("freeze_id, cards(id, english)"),
  ]);

  const cardsByFreeze = new Map<string, CardLink[]>();
  for (const l of (linkRes.data ?? []) as unknown as {
    freeze_id: string;
    cards: { id: string; english: string } | null;
  }[]) {
    if (!l.cards) continue;
    const list = cardsByFreeze.get(l.freeze_id) ?? [];
    list.push({ id: l.cards.id, englishPrompt: l.cards.english });
    cardsByFreeze.set(l.freeze_id, list);
  }

  const rows = (allRes.data ?? []) as Row[];
  const untriaged = rows
    .filter((r) => r.outcome === null)
    .map((r) => toFreeze(r, cardsByFreeze.get(r.id) ?? []))
    // Oldest first: the queue is worked front to back.
    .reverse();

  const triaged = rows
    .filter((r) => r.outcome !== null)
    .map((r) => toFreeze(r, cardsByFreeze.get(r.id) ?? []));

  return { untriaged, triaged };
}
