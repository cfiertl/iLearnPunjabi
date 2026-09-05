import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UsageSummary = {
  total: number;
  byKind: Record<string, number>;
  budget: number;
  percent: number; // 0..1+ (of budget)
  over: boolean; // >= 100% of budget
  warn: boolean; // >= 80% of budget
};

/** Sum this calendar month's AI spend for the current user, vs their budget. */
export async function getMonthlyUsage(): Promise<UsageSummary> {
  const supabase = await createClient();

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const [{ data: events }, { data: settings }] = await Promise.all([
    supabase
      .from("usage_events")
      .select("kind, cost_usd")
      .gte("created_at", start.toISOString()),
    supabase.from("user_settings").select("monthly_budget_usd").maybeSingle(),
  ]);

  const byKind: Record<string, number> = {};
  let total = 0;
  for (const e of events ?? []) {
    const c = Number(e.cost_usd) || 0;
    total += c;
    byKind[e.kind] = (byKind[e.kind] ?? 0) + c;
  }

  const budget = Number(settings?.monthly_budget_usd ?? 10);
  const percent = budget > 0 ? total / budget : 0;

  return {
    total,
    byKind,
    budget,
    percent,
    over: budget > 0 && total >= budget,
    warn: percent >= 0.8,
  };
}
