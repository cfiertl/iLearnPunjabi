"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importKey, parseImport } from "@/lib/cards/import";
import { SEED_DECK_NAME, SEED_SENTENCES } from "@/content/seed-cards";
import type { SupabaseClient } from "@supabase/supabase-js";

type FreezeRow = {
  id: string;
  english: string;
  captured_at: string;
  bucket: string | null;
  note: string | null;
  resolved: boolean;
};

export type ImportPreview = {
  ok: boolean;
  total: number;
  toAdd: number;
  duplicates: number;
  unknownTags: string[];
  errors: string[];
};

/** The single deck every sentence card hangs off. Created on first use. */
async function ensureDeck(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId)
    .eq("name", SEED_DECK_NAME)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      name: SEED_DECK_NAME,
      level: "A2",
      dialect_scope: "eastern",
      description: "Sentence production cards, tagged by agreement frame.",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create deck");
  return data.id as string;
}

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

/** Insert the new cards from a batch. Re-importing the same batch is a no-op. */
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
      freeze_id: c.freezeId,
      active: true,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("cards").insert(rows);
    if (error) throw error;
  }

  revalidatePath("/cards");
  revalidatePath("/study");
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
  ] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, english, gurmukhi, roman, frame_tag, agreement_slot, slot_index_roman, slot_index_gurmukhi, notes, audio_id, active, created_at, family_variant, verified, freeze_id",
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
        .select("id, english, captured_at, bucket, note, resolved")
        .order("captured_at"),
    ]);

  // cardIds is stored the other way round (cards.freeze_id), so derive it.
  const cardsByFreeze = new Map<string, string[]>();
  for (const c of (cards ?? []) as { id: string; freeze_id: string | null }[]) {
    if (!c.freeze_id) continue;
    const list = cardsByFreeze.get(c.freeze_id) ?? [];
    list.push(c.id);
    cardsByFreeze.set(c.freeze_id, list);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schema: "punjabi-srs/2",
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
      verified: c.verified,
      freezeId: c.freeze_id,
    })),
    reviewState: state ?? [],
    reviewEvents: events ?? [],
    audioClips: clips ?? [],
    freezes: ((freezes ?? []) as FreezeRow[]).map((f) => ({
      id: f.id,
      english: f.english,
      capturedAt: f.captured_at,
      bucket: f.bucket,
      note: f.note,
      resolved: f.resolved,
      cardIds: cardsByFreeze.get(f.id) ?? [],
    })),
  };

  return JSON.stringify(payload, null, 2);
}
