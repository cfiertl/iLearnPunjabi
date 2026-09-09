import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  LOG_KINDS,
  type LearningLog,
  type LogDay,
  type LogKind,
} from "@/lib/log/types";

/** Every day in the window, most recent first, with what happened on it. */
export async function getLearningLog(windowDays = 28): Promise<LearningLog> {
  const supabase = await createClient();

  // Independent queries — one round trip for the whole screen.
  const [cardRes, todayRes, manualRes] = await Promise.all([
    supabase.rpc("log_card_days", { p_days: windowDays }),
    supabase.rpc("my_today"),
    supabase
      .from("learning_sessions")
      .select("occurred_on, kind")
      .order("occurred_on", { ascending: false }),
  ]);

  const today =
    typeof todayRes.data === "string"
      ? todayRes.data
      : new Date().toISOString().slice(0, 10);

  const reviewsByDay = new Map<string, number>(
    ((cardRes.data ?? []) as { day: string; reviews: number }[]).map((r) => [
      r.day,
      r.reviews,
    ]),
  );

  const kindsByDay = new Map<string, LogKind[]>();
  for (const row of (manualRes.data ?? []) as {
    occurred_on: string;
    kind: LogKind;
  }[]) {
    const list = kindsByDay.get(row.occurred_on) ?? [];
    list.push(row.kind);
    kindsByDay.set(row.occurred_on, list);
  }

  // Walk back from today so empty days are present rather than missing.
  const days: LogDay[] = [];
  const cursor = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < windowDays; i++) {
    const day = cursor.toISOString().slice(0, 10);
    days.push({
      day,
      reviews: reviewsByDay.get(day) ?? 0,
      kinds: kindsByDay.get(day) ?? [],
    });
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const totals = {
    cardDays: days.filter((d) => d.reviews > 0).length,
    window: windowDays,
  } as LearningLog["totals"];
  for (const { kind } of LOG_KINDS) {
    totals[kind] = days.filter((d) => d.kinds.includes(kind)).length;
  }

  return { today, days, totals };
}
