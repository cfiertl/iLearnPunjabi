"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importKey, parseImport } from "@/lib/cards/import";
import { SEED_SENTENCES } from "@/content/seed-cards";
import { ensureDeck } from "@/lib/cards/deck";
import type { SupabaseClient } from "@supabase/supabase-js";

type FreezeRow = {
  id: string;
  english: string;
  captured_at: string;
  bucket: string | null;
  outcome: string | null;
  waiting_on: string | null;
  note: string | null;
  resolved: boolean;
  triaged_at: string | null;
  batch_id: string | null;
};

export type ImportPreview = {
  ok: boolean;
  total: number;
  toAdd: number;
  duplicates: number;
  unknownTags: string[];
  errors: string[];
};

/** Existing (prompt + sentence) keys, so imports stay idempotent. */
async function existingKeys(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("cards")
    .select("english, gurmukhi")
    .eq("user_id", userId)
    .not("frame_tag", "is", null);

  return new Set(
    (data ?? []).map((r) => importKey(r.english ?? "", r.gurmukhi ?? "")),
  );
}

/** Validate a pasted batch and report what would happen — no writes. */
export async function previewImport(raw: string): Promise<ImportPreview> {
  const { cards, errors, unknownTags } = parseImport(raw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, total: 0, toAdd: 0, duplicates: 0, unknownTags, errors: ["Not signed in."] };
  }

  const seen = await existingKeys(supabase, user.id);
  const batch = new Set<string>();
  let duplicates = 0;
  for (const c of cards) {
    const k = importKey(c.englishPrompt, c.gurmukhi);
    if (seen.has(k) || batch.has(k)) duplicates += 1;
    else batch.add(k);
  }

  return {
    ok: cards.length > 0,
    total: cards.length,
    toAdd: batch.size,
    duplicates,
    unknownTags,
    errors,
  };
}

/**
 * Insert the new cards from a batch. Re-importing the same batch is a no-op.
 *
 * Bulk loading only. It never touches freezes: links and triage arrive in a
 * session import, so there is exactly one path by which a freeze changes.
 */
export async function runImport(raw: string) {
  const { cards, errors } = parseImport(raw);
  if (cards.length === 0) {
    return { ok: false, added: 0, skipped: 0, errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const deckId = await ensureDeck(supabase, user.id);
  const seen = await existingKeys(supabase, user.id);

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const c of cards) {
    const k = importKey(c.englishPrompt, c.gurmukhi);
    if (seen.has(k)) {
      skipped += 1;
      continue;
    }
    seen.add(k);
    rows.push({
      deck_id: deckId,
      user_id: user.id,
      english: c.englishPrompt,
      gurmukhi: c.gurmukhi,
      roman: c.roman,
      frame_tag: c.frameTag,
      agreement_slot: c.agreementSlot,
      slot_index_roman: c.slotIndexRoman,
      slot_index_gurmukhi: c.slotIndexGurmukhi,
      notes: c.notes,
      family_variant: c.familyVariant,
      verified: c.verified,
      active: true,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("cards").insert(rows);
    if (error) throw error;
  }

  revalidatePath("/cards");
  revalidatePath("/study");
  revalidatePath("/freezes");
  revalidatePath("/");
  return { ok: true, added: rows.length, skipped, errors };
}

/** Load the 4 dummy sentence cards so the loop can be exercised immediately. */
export async function seedDummyCards() {
  return runImport(JSON.stringify(SEED_SENTENCES));
}

/**
 * Everything except audio blobs, pretty-printed.
 * This gets pasted into a tutoring conversation for analysis, so readability
 * matters more than size.
 */
export async function exportAll(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [
    { data: cards },
    { data: state },
    { data: events },
    { data: clips },
    { data: freezes },
    { data: links },
    { data: imports },
  ] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, english, gurmukhi, roman, frame_tag, agreement_slot, slot_index_roman, slot_index_gurmukhi, notes, audio_id, active, created_at, family_variant, standard_roman, verified, freeze_id, batch_id",
        )
        .not("frame_tag", "is", null)
        .order("created_at"),
      supabase.from("card_review_state").select("*"),
      supabase.from("review_events").select("*").order("reviewed_at"),
      // Metadata only — blobs stay in Storage.
      supabase.from("audio_clips").select("id, speaker, duration_ms, recorded_at"),
      // Everything, including untriaged and discarded. Untriaged rows are the
      // most useful ones in the file, so they are never filtered or summarised.
      supabase
        .from("freezes")
        .select(
          "id, english, captured_at, bucket, outcome, waiting_on, note, resolved, triaged_at, batch_id",
        )
        .order("captured_at"),
      supabase.from("freeze_cards").select("freeze_id, card_id"),
      // Every applied session batch, so the next session can confirm the last
      // one landed before building on it.
      supabase
        .from("imports")
        .select("batch_id, summary, created_at, applied_at, cards_added, cards_updated, freezes_updated")
        .order("applied_at"),
    ]);

  const cardsByFreeze = new Map<string, string[]>();
  for (const l of (links ?? []) as { freeze_id: string; card_id: string }[]) {
    const list = cardsByFreeze.get(l.freeze_id) ?? [];
    list.push(l.card_id);
    cardsByFreeze.set(l.freeze_id, list);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schema: "punjabi-srs/3",
    cards: (cards ?? []).map((c) => ({
      id: c.id,
      englishPrompt: c.english,
      gurmukhi: c.gurmukhi,
      roman: c.roman,
      frameTag: c.frame_tag,
      agreementSlot: c.agreement_slot,
      slotIndexRoman: c.slot_index_roman,
      slotIndexGurmukhi: c.slot_index_gurmukhi,
      notes: c.notes,
      audioId: c.audio_id,
      active: c.active,
      createdAt: c.created_at,
      familyVariant: c.family_variant,
      standardRoman: c.standard_roman,
      verified: c.verified,
      // Superseded by freezes[].cardIds; kept so older files still line up.
      freezeId: c.freeze_id,
      batchId: c.batch_id,
    })),
    reviewState: state ?? [],
    reviewEvents: events ?? [],
    audioClips: clips ?? [],
    freezes: ((freezes ?? []) as FreezeRow[]).map((f) => ({
      id: f.id,
      english: f.english,
      capturedAt: f.captured_at,
      bucket: f.bucket,
      outcome: f.outcome,
      waitingOn: f.waiting_on,
      note: f.note,
      resolved: f.resolved,
      cardIds: cardsByFreeze.get(f.id) ?? [],
      triagedAt: f.triaged_at,
      batchId: f.batch_id,
    })),
    imports: (imports ?? []).map((i) => ({
      batchId: i.batch_id,
      summary: i.summary,
      createdAt: i.created_at,
      appliedAt: i.applied_at,
      counts: {
        cardsAdded: i.cards_added,
        cardsUpdated: i.cards_updated,
        freezesUpdated: i.freezes_updated,
      },
    })),
  };

  return JSON.stringify(payload, null, 2);
}
