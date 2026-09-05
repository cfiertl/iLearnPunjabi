"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isScriptMode } from "@/lib/study/types";

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const cap = Number(formData.get("session_cap"));
  const newPerDay = Number(formData.get("new_per_day"));
  // A checkbox is absent from the payload when unchecked.
  const friction = formData.get("flip_friction") !== null;

  const patch: Record<string, number | string> = {};

  const script = formData.get("script_mode");
  if (isScriptMode(script)) patch.script_mode = script;

  if (Number.isFinite(cap) && cap >= 1) patch.session_cap = Math.round(cap);
  if (Number.isFinite(newPerDay) && newPerDay >= 0) {
    patch.new_per_day = Math.round(newPerDay);
  }
  patch.flip_delay_ms = friction ? 1500 : 0;

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/settings");
  revalidatePath("/study");
  revalidatePath("/study/cloze");
}
