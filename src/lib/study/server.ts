import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Box, ReviewMode } from "@/lib/leitner";
import type { SessionPrefs, TrainerCard } from "@/lib/study/types";

/** One row of get_study_session: a card, its box, and any attached clip. */
type SessionRow = {
  card_id: string;
  english_prompt: string;
  gurmukhi: string | null;
  roman: string;
  frame_tag: string | null;
  agreement_slot: string | null;
  slot_index_roman: number | null;
  slot_index_gurmukhi: number | null;
  notes: string | null;
  box: Box;
  audio_url: string | null;
  audio_speaker: string | null;
};

function toCard(r: SessionRow): TrainerCard {
  return {
    id: r.card_id,
    englishPrompt: r.english_prompt,
    gurmukhi: r.gurmukhi ?? "",
    roman: r.roman,
    frameTag: r.frame_tag ?? "",
    agreementSlot: r.agreement_slot,
    slotIndexRoman: r.slot_index_roman,
    slotIndexGurmukhi: r.slot_index_gurmukhi,
    notes: r.notes,
    audioUrl: r.audio_url,
    audioSpeaker: r.audio_speaker,
    box: r.box ?? 1,
  };
}

export async function getSessionPrefs(): Promise<SessionPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("session_cap, new_per_day, flip_delay_ms")
    .maybeSingle();

  return {
    sessionCap: data?.session_cap ?? 30,
    newPerDay: data?.new_per_day ?? 10,
    flipDelayMs: data?.flip_delay_ms ?? 1500,
  };
}

/**
 * A whole study session in one round trip — queue, boxes and audio together.
 * The RPC applies session_cap and new_per_day server-side, so this no longer
 * has to wait on a preferences query before it can ask for cards.
 */
export async function getStudySession(mode: ReviewMode): Promise<TrainerCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_study_session", {
    p_mode: mode,
  });
  if (error || !data) return [];
  return (data as SessionRow[]).map(toCard);
}

/**
 * Home screen counts. Every query here is independent, so they run
 * concurrently — the whole screen costs one round trip, not three.
 */
export async function getDashboardStats() {
  const supabase = await createClient();

  const [production, cloze, { count: sentenceCards }] = await Promise.all([
    supabase.rpc("count_due_reviews", { p_mode: "production" }),
    supabase.rpc("count_due_reviews", { p_mode: "cloze" }),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .not("frame_tag", "is", null)
      .eq("active", true),
  ]);

  return {
    dueProduction: typeof production.data === "number" ? production.data : 0,
    dueCloze: typeof cloze.data === "number" ? cloze.data : 0,
    cardCount: sentenceCards ?? 0,
  };
}
