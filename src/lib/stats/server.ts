import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WeekPoint = { weekStart: string; total: number; agreement: number };

export type FrameRow = {
  frameTag: string;
  total: number;
  agreement: number;
  rate: number;
  /** -1 when the window holds no reviews, so the UI can show no arrow. */
  recentRate: number;
  priorRate: number;
};

export type Leech = {
  cardId: string;
  englishPrompt: string;
  roman: string;
  frameTag: string;
  agreementFails: number;
  lapses: number;
};

export type StatsData = {
  weeks: WeekPoint[];
  frames: FrameRow[];
  leeches: Leech[];
  boxes: number[]; // index 0 = box 1
  forecast: { day: string; due: number }[];
  totalReviews: number;
  totalAgreement: number;
};

/** Everything the statistics screen needs, in one round trip. */
export async function getStats(): Promise<StatsData> {
  const supabase = await createClient();

  const [weekRes, frameRes, forecastRes, boxRes, leechRes] = await Promise.all([
    supabase.rpc("stats_weekly_agreement"),
    supabase.rpc("stats_by_frame"),
    supabase.rpc("stats_forecast"),
    supabase.from("card_review_state").select("box").eq("mode", "production"),
    supabase
      .from("card_review_state")
      .select("card_id, agreement_fails, lapses, cards(english, roman, frame_tag)")
      .gte("agreement_fails", 4)
      .order("agreement_fails", { ascending: false }),
  ]);

  const weeks: WeekPoint[] = ((weekRes.data ?? []) as RawWeek[]).map((w) => ({
    weekStart: w.week_start,
    total: w.total,
    agreement: w.agreement,
  }));

  const frames: FrameRow[] = ((frameRes.data ?? []) as RawFrame[]).map((f) => ({
    frameTag: f.frame_tag,
    total: f.total,
    agreement: f.agreement,
    rate: f.total > 0 ? f.agreement / f.total : 0,
    recentRate: Number(f.recent_rate),
    priorRate: Number(f.prior_rate),
  }));

  const boxes = [0, 0, 0, 0, 0];
  for (const r of (boxRes.data ?? []) as { box: number }[]) {
    if (r.box >= 1 && r.box <= 5) boxes[r.box - 1] += 1;
  }

  const leeches: Leech[] = (
    (leechRes.data ?? []) as unknown as RawLeech[]
  ).map((l) => {
    // PostgREST returns an object for this many-to-one embed, but supabase-js
    // types it as an array without generated types — accept either.
    const card = Array.isArray(l.cards) ? l.cards[0] : l.cards;
    return {
      cardId: l.card_id,
      englishPrompt: card?.english ?? "(card missing)",
      roman: card?.roman ?? "",
      frameTag: card?.frame_tag ?? "",
      agreementFails: l.agreement_fails,
      lapses: l.lapses,
    };
  });

  return {
    weeks,
    frames,
    leeches,
    boxes,
    forecast: ((forecastRes.data ?? []) as RawForecast[]).map((f) => ({
      day: f.day,
      due: f.due,
    })),
    totalReviews: weeks.reduce((n, w) => n + w.total, 0),
    totalAgreement: weeks.reduce((n, w) => n + w.agreement, 0),
  };
}

type RawWeek = { week_start: string; total: number; agreement: number };
type RawFrame = {
  frame_tag: string;
  total: number;
  agreement: number;
  recent_rate: number | string;
  prior_rate: number | string;
};
type RawForecast = { day: string; due: number };
type CardEmbed = { english: string; roman: string; frame_tag: string };
type RawLeech = {
  card_id: string;
  agreement_fails: number;
  lapses: number;
  cards: CardEmbed | CardEmbed[] | null;
};
