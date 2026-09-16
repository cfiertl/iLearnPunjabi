"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Capture a freeze. English only, no lookup, no categorising, no confirmation.
 *
 * The value of a freeze is that it records what could NOT be done unaided, so
 * nothing here may help resolve it in the moment.
 */
export async function captureFreeze(english: string) {
  const text = english.trim();
  if (!text) throw new Error("Nothing to save");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("freezes")
    .insert({ user_id: user.id, english: text });
  if (error) throw error;

  revalidatePath("/freezes");
  return { ok: true };
}
