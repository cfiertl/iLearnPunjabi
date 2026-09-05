import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Box, ReviewMode } from "@/lib/leitner";
import type { SessionPrefs, TrainerCard } from "@/lib/study/types";

/** Shape of a public.cards row, as returned by get_review_queue. */
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
  audio_id: string | null;
};

type ClipRow = { id: string; url: string; speaker: string };

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
 * The due queue for one mode: due cards first, then unseen cards up to the
 * daily new-card budget. Boxes and attached audio are joined on afterwards.
 */
export async function getReviewQueue(
  mode: ReviewMode,
  prefs: SessionPrefs,
): Promise<TrainerCard[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_review_queue", {
    p_mode: mode,
    p_limit: prefs.sessionCap,
    p_new_limit: prefs.newPerDay,
  });
  if (error || !data) return [];

  const rows = data as CardRow[];
  if (rows.length === 0) return [];

  const [{ data: states }, { data: clips }] = await Promise.all([
    supabase
      .from("card_review_state")
      .select("card_id, box")
      .eq("mode", mode)
      .in(
        "card_id",
        rows.map((r) => r.id),
      ),
    (async () => {
      const ids = rows.map((r) => r.audio_id).filter((x): x is string => !!x);
      if (ids.length === 0) return { data: [] as ClipRow[] };
      return supabase.from("audio_clips").select("id, url, speaker").in("id", ids);
    })(),
  ]);

  const boxById = new Map(
    (states ?? []).map((s) => [s.card_id as string, s.box as Box]),
  );
  const clipById = new Map(
    ((clips ?? []) as ClipRow[]).map((c) => [c.id, c]),
  );

  return rows.map((r) => {
    const clip = r.audio_id ? clipById.get(r.audio_id) : undefined;
    return {
      id: r.id,
      englishPrompt: r.english,
      gurmukhi: r.gurmukhi ?? "",
      roman: r.roman,
      frameTag: r.frame_tag ?? "",
      agreementSlot: r.agreement_slot,
      slotIndexRoman: r.slot_index_roman,
      slotIndexGurmukhi: r.slot_index_gurmukhi,
      notes: r.notes,
      audioUrl: clip?.url ?? null,
      audioSpeaker: clip?.speaker ?? null,
      box: boxById.get(r.id) ?? 1,
    };
  });
}

/** Home screen: what is waiting, and how big the sentence bank is. */
export async function getDashboardStats(prefs: SessionPrefs) {
  const supabase = await createClient();

  const [production, cloze, { count: sentenceCards }] = await Promise.all([
    supabase.rpc("count_review_queue", {
      p_mode: "production",
      p_new_limit: prefs.newPerDay,
    }),
    supabase.rpc("count_review_queue", {
      p_mode: "cloze",
      p_new_limit: prefs.newPerDay,
    }),
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
