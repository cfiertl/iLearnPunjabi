import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEED_DECK_NAME } from "@/content/seed-cards";

/** The single deck every sentence card hangs off. Created on first use. */
export async function ensureDeck(supabase: SupabaseClient, userId: string) {
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
