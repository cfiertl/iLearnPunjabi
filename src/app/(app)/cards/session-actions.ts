"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureDeck } from "@/lib/cards/deck";
import {
  validateSession,
  type DeckCard,
  type SessionPreview,
  type Snapshot,
} from "@/lib/imports/session";
import { ensureGurmukhiSeed, loadContent } from "@/lib/gurmukhi/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type CardRow = {
  id: string;
  english: string;
  gurmukhi: string | null;
  roman: string;
  frame_tag: string | null;
  agreement_slot: string | null;
  slot_index_roman: number | null;
  slot_index_gurmukhi: number | null;
  notes: string | null;
  family_variant: string | null;
  standard_roman: string | null;
  verified: boolean | null;
  active: boolean | null;
};

/** The deck, freezes and applied batches the file is checked against. */
async function loadSnapshot(
  supabase: SupabaseClient,
  userId: string,
  withGurmukhi: boolean,
): Promise<Snapshot> {
  const [cardRes, freezeRes, importRes] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, english, gurmukhi, roman, frame_tag, agreement_slot, slot_index_roman, slot_index_gurmukhi, notes, family_variant, standard_roman, verified, active",
      )
      .not("frame_tag", "is", null),
    supabase.from("freezes").select("id, english"),
    supabase.from("imports").select("batch_id"),
  ]);
  // Only a file with a gurmukhi section reads the drill tables, so a file
  // without one works exactly as before — even before migration 0011.
  const gurmukhi = withGurmukhi ? await loadGurmukhi(supabase, userId) : null;
  // A failed read must not look like an empty deck: every id would then be
  // reported missing, or worse, a reused batch id would pass.
  for (const r of [cardRes, freezeRes, importRes]) {
    if (r.error) throw r.error;
  }

  return {
    cards: ((cardRes.data ?? []) as CardRow[]).map(
      (r): DeckCard => ({
        id: r.id,
        englishPrompt: r.english,
        gurmukhi: r.gurmukhi ?? "",
        roman: r.roman,
        frameTag: r.frame_tag,
        agreementSlot: r.agreement_slot,
        slotIndexRoman: r.slot_index_roman,
        slotIndexGurmukhi: r.slot_index_gurmukhi,
        notes: r.notes,
        familyVariant: r.family_variant,
        standardRoman: r.standard_roman,
        verified: r.verified === true,
        active: r.active !== false,
      }),
    ),
    freezes: (freezeRes.data ?? []) as { id: string; english: string }[],
    appliedBatchIds: ((importRes.data ?? []) as { batch_id: string }[]).map(
      (i) => i.batch_id,
    ),
    gurmukhi,
  };
}

/** Seeded first, so a label update can target a letter the drill never opened. */
async function loadGurmukhi(supabase: SupabaseClient, userId: string) {
  try {
    await ensureGurmukhiSeed(supabase, userId);
    return await loadContent(supabase);
  } catch {
    return null;
  }
}

function failed(message: string): SessionPreview {
  return {
    ok: false,
    errors: [message],
    warnings: [],
    batchId: null,
    summary: null,
    cardsAdded: [],
    cardsUpdated: [],
    freezesUpdated: [],
    gurmukhiChanges: [],
  };
}

async function check(raw: string) {
  let file: unknown;
  try {
    file = JSON.parse(raw);
  } catch {
    return { preview: failed("That is not valid JSON."), plan: null, supabase: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { preview: failed("Not signed in."), plan: null, supabase: null };

  const withGurmukhi =
    typeof file === "object" && file !== null && "gurmukhi" in file;
  const [snapshot, deckId] = await Promise.all([
    loadSnapshot(supabase, user.id, withGurmukhi),
    ensureDeck(supabase, user.id),
  ]);
  return { ...validateSession(file, snapshot, deckId), supabase };
}

/** Validate a session file and describe every change it makes. No writes. */
export async function previewSessionImport(raw: string): Promise<SessionPreview> {
  return (await check(raw)).preview;
}

/**
 * Apply a session file in one transaction.
 *
 * Re-validates against the current data rather than trusting the earlier
 * preview: the deck may have changed in between, and a stale plan could link a
 * freeze to a card that no longer exists.
 */
export async function applySessionImport(
  raw: string,
): Promise<{ ok: true; preview: SessionPreview } | { ok: false; preview: SessionPreview }> {
  const { preview, plan, supabase } = await check(raw);
  if (!plan || !supabase) return { ok: false, preview };

  const { error } = await supabase.rpc("apply_session_import", { p_plan: plan });
  if (error) {
    return { ok: false, preview: { ...preview, ok: false, errors: [error.message] } };
  }

  revalidatePath("/cards");
  revalidatePath("/cards/[id]", "page");
  revalidatePath("/freezes");
  revalidatePath("/study");
  revalidatePath("/study/cloze");
  if (preview.gurmukhiChanges.length) {
    revalidatePath("/study/gurmukhi");
    revalidatePath("/stats");
  }
  revalidatePath("/");
  return { ok: true, preview };
}
