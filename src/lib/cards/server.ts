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
  freeze: { id: string; english: string } | null;
};

const COLUMNS =
  "id, english, roman, gurmukhi, frame_tag, agreement_slot, slot_index_roman, slot_index_gurmukhi, notes, family_variant, verified, active, freeze_id";

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
  verified: boolean | null;
  active: boolean | null;
  freeze_id: string | null;
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
    r.freeze_id
      ? supabase
          .from("freezes")
          .select("id, english")
          .eq("id", r.freeze_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
    verified: r.verified === true,
    active: r.active !== false,
    box: stateRes.data?.box ?? null,
    freeze: (freezeRes.data as { id: string; english: string } | null) ?? null,
  };
}
