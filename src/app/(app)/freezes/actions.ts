"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isBucket, type Bucket } from "@/lib/freezes/types";

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

/** Assign a bucket at triage, optionally with a note. */
export async function triageFreeze(
  id: string,
  bucket: Bucket,
  note?: string | null,
) {
  if (!isBucket(bucket)) throw new Error("Invalid bucket");

  const supabase = await createClient();
  const patch: Record<string, unknown> = { bucket };
  if (note !== undefined) patch.note = note?.trim() || null;

  const { error } = await supabase.from("freezes").update(patch).eq("id", id);
  if (error) throw error;

  revalidatePath("/freezes");
  return { ok: true };
}

/**
 * Discard without triaging. A normal outcome, not a failure: the weekly cap is
 * ten new cards and a good week produces more candidates than that.
 */
export async function discardFreeze(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("freezes")
    .update({ outcome: "discarded" })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/freezes");
  return { ok: true };
}

/** Put a triaged or discarded freeze back in the queue. */
export async function reopenFreeze(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("freezes")
    .update({ bucket: null, outcome: null, waiting_on: null })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/freezes");
  return { ok: true };
}
