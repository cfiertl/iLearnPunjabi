import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageKind = "tts" | "stt" | "chat";

/**
 * Log a paid API call. Best-effort: never throws, so a logging failure can't
 * break the feature that incurred the cost.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  e: {
    kind: UsageKind;
    provider?: string;
    model?: string;
    units?: number;
    unitType?: string;
    costUsd: number;
  },
): Promise<void> {
  try {
    await supabase.from("usage_events").insert({
      user_id: userId,
      kind: e.kind,
      provider: e.provider ?? null,
      model: e.model ?? null,
      units: e.units ?? null,
      unit_type: e.unitType ?? null,
      cost_usd: e.costUsd,
    });
  } catch {
    // swallow — cost logging is non-critical
  }
}
