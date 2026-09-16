import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CardSummary = {
  id: string;
  englishPrompt: string;
  roman: string;
  frameTag: string | null;
  active: boolean;
  verified: boolean;
  familyVariant: string | null;
  /** Production box, or null if never reviewed. */
  box: number | null;
};

export type CardDetail = CardSummary & {
  gurmukhi: string;
  agreementSlot: string | null;
  slotIndexRoman: number | null;
  slotIndexGurmukhi: number | null;
  notes: string | null;
  standardRoman: string | null;
  /** The session import that created or last changed this card. */
  batchId: string | null;
  /** Freezes this card is linked to. Display-only. */
  freezes: { id: string; english: string }[];
};

const COLUMNS =
  "id, english, roman, gurmukhi, frame_tag, agreement_slot, slot_index_roman, slot_index_gurmukhi, notes, family_variant, standard_roman, batch_id, verified, active";

type Row = {
  id: string;
  english: string;
  roman: string;
  gurmukhi: string | null;
  frame_tag: string | null;
  agreement_slot: string | null;
  slot_index_roman: number | null;
  slot_index_gurmukhi: number | null;
  notes: string | null;
  family_variant: string | null;
  standard_roman?: string | null;
  batch_id?: string | null;
  verified: boolean | null;
  active: boolean | null;
};

/** Every sentence card, retired ones included, newest last. */
export async function listCards(): Promise<CardSummary[]> {
  const supabase = await createClient();

  const [cardRes, stateRes] = await Promise.all([
    supabase
      .from("cards")
      .select(COLUMNS)
      .not("frame_tag", "is", null)
      .order("created_at"),
    supabase
      .from("card_review_state")
      .select("card_id, box")
      .eq("mode", "production"),
  ]);

  const boxes = new Map(
    ((stateRes.data ?? []) as { card_id: string; box: number }[]).map((s) => [
      s.card_id,
      s.box,
    ]),
  );

  return ((cardRes.data ?? []) as Row[]).map((r) => ({
    id: r.id,
    englishPrompt: r.english,
    roman: r.roman,
    frameTag: r.frame_tag,
    active: r.active !== false,
    verified: r.verified === true,
    familyVariant: r.family_variant,
    box: boxes.get(r.id) ?? null,
  }));
}

export async function getCard(id: string): Promise<CardDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cards")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as Row;

  const [stateRes, freezeRes] = await Promise.all([
    supabase
      .from("card_review_state")
      .select("box")
      .eq("card_id", id)
      .eq("mode", "production")
      .maybeSingle(),
    supabase
      .from("freeze_cards")
      .select("freezes(id, english)")
      .eq("card_id", id),
  ]);

  return {
    id: r.id,
    englishPrompt: r.english,
    roman: r.roman,
    gurmukhi: r.gurmukhi ?? "",
    frameTag: r.frame_tag,
    agreementSlot: r.agreement_slot,
    slotIndexRoman: r.slot_index_roman,
    slotIndexGurmukhi: r.slot_index_gurmukhi,
    notes: r.notes,
    familyVariant: r.family_variant,
    standardRoman: r.standard_roman ?? null,
    batchId: r.batch_id ?? null,
    verified: r.verified === true,
    active: r.active !== false,
    box: stateRes.data?.box ?? null,
    freezes: ((freezeRes.data ?? []) as unknown as {
      freezes: { id: string; english: string } | null;
    }[])
      .map((l) => l.freezes)
      .filter((f): f is { id: string; english: string } => f !== null),
  };
}
