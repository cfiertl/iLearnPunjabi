"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, isLogKind, type LogKind } from "@/lib/log/types";

/**
 * Record or clear one part of the routine for one day.
 *
 * Card work is never written here — it is derived from review_events, which the
 * app records on its own.
 */
export async function toggleLogEntry(
  occurredOn: string,
  kind: LogKind,
  on: boolean,
) {
  if (!isIsoDate(occurredOn)) throw new Error("Invalid date");
  if (!isLogKind(kind)) throw new Error("Invalid kind");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (on) {
    const { error } = await supabase.from("learning_sessions").upsert(
      { user_id: user.id, occurred_on: occurredOn, kind },
      { onConflict: "user_id,occurred_on,kind" },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("learning_sessions")
      .delete()
      .eq("user_id", user.id)
      .eq("occurred_on", occurredOn)
      .eq("kind", kind);
    if (error) throw error;
  }

  revalidatePath("/log");
  return { ok: true };
}
