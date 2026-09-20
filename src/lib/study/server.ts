import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Box, ReviewMode } from "@/lib/leitner";
import { isScriptMode } from "@/lib/study/types";
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
  family_variant: string | null;
  verified: boolean | null;
  /** Absent until migration 0010 has run; treated as null. */
  standard_roman?: string | null;
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
    familyVariant: r.family_variant,
    standardRoman: r.standard_roman ?? null,
    verified: r.verified === true,
  };
}

export async function getSessionPrefs(): Promise<SessionPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("session_cap, new_per_day, flip_delay_ms, script_mode")
    .maybeSingle();

  return {
    sessionCap: data?.session_cap ?? 30,
    newPerDay: data?.new_per_day ?? 10,
    flipDelayMs: data?.flip_delay_ms ?? 1500,
    scriptMode: isScriptMode(data?.script_mode)
      ? data.script_mode
      : "roman_primary",
  };
}

/**
 * A whole study session in one round trip — queue, boxes and audio together.
 * The RPC applies session_cap and new_per_day server-side, so this no longer
 * has to wait on a preferences query before it can ask for cards.
 *
 * `session_cap` is a budget for the DAY, not for each visit: the RPC subtracts
 * what has already been reviewed since the learner's midnight. Stopping twelve
 * cards in and coming back gives the remaining eighteen, not a fresh thirty.
 * `ignoreDailyCap` is the deliberate opt-out — a second helping once the day's
 * set is finished.
 */
export async function getStudySession(
  mode: ReviewMode,
  { ignoreDailyCap = false }: { ignoreDailyCap?: boolean } = {},
): Promise<TrainerCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_study_session", {
    p_mode: mode,
    p_ignore_daily_cap: ignoreDailyCap,
  });
  if (error || !data) return [];

  // Cloze cards whose slot cannot be located must be dropped, but which script
  // is blanked is now a preference — so the caller filters with isClozeable
  // once it knows the mode, rather than this fetching preferences first and
  // costing an extra serial round trip.
  return (data as SessionRow[]).map(toCard);
}

/** Cards reviewed in this mode since the learner's midnight. */
export async function countReviewedToday(mode: ReviewMode): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_reviews_today", { p_mode: mode });
  return typeof data === "number" ? data : 0;
}

/**
 * Everything that is due, ignoring today's budget.
 *
 * Only used to tell "the day's set is done, but there is more waiting if you
 * want it" apart from "genuinely nothing is due" — two states that otherwise
 * both show up as an empty queue.
 */
export async function countDueIgnoringDailyCap(
  mode: ReviewMode,
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("count_due_reviews", {
    p_mode: mode,
    p_ignore_daily_cap: true,
  });
  return typeof data === "number" ? data : 0;
}

/**
 * Home screen counts. Every query here is independent, so they run
 * concurrently — the whole screen costs one round trip, not five.
 *
 * `dueProduction` / `dueCloze` are now what the study page will actually hand
 * over: due cards capped by what is left of today's budget. Before the cap was
 * shared, the home screen advertised a backlog the session never served.
 */
export async function getDashboardStats() {
  const supabase = await createClient();

  const [production, cloze, { count: sentenceCards }, prefs, reviewedToday] =
    await Promise.all([
      supabase.rpc("count_due_reviews", { p_mode: "production" }),
      supabase.rpc("count_due_reviews", { p_mode: "cloze" }),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .not("frame_tag", "is", null)
        .eq("active", true),
      getSessionPrefs(),
      countReviewedToday("production"),
    ]);

  return {
    dueProduction: typeof production.data === "number" ? production.data : 0,
    dueCloze: typeof cloze.data === "number" ? cloze.data : 0,
    cardCount: sentenceCards ?? 0,
    reviewedToday,
    dailyCap: prefs.sessionCap,
  };
}
