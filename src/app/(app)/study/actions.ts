"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  applyGrade,
  isGrade,
  isMode,
  isTimeZone,
  type Grade,
  type ReviewMode,
} from "@/lib/leitner";

/**
 * Record one review: schedule the (card, mode) pair with Leitner and append an
 * immutable review event.
 *
 * `agreement` and `fail` schedule identically — they differ only in what they
 * record. That difference is the whole point of the app.
 */
export async function submitGrade(
  cardId: string,
  mode: ReviewMode,
  grade: Grade,
  timeZone?: string,
) {
  if (!isMode(mode)) throw new Error("Invalid mode");
  if (!isGrade(grade)) throw new Error("Invalid grade");

  // The browser knows the learner timezone for free; the server runs in UTC and
  // would otherwise put the day boundary in the middle of their morning.
  const zone = isTimeZone(timeZone) ? timeZone : "UTC";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: card }, { data: current }] = await Promise.all([
    supabase
      .from("cards")
      .select("id, frame_tag")
      .eq("id", cardId)
      .maybeSingle(),
    supabase
      .from("card_review_state")
      .select("box, lapses, agreement_fails")
      .eq("card_id", cardId)
      .eq("mode", mode)
      .maybeSingle(),
  ]);
  if (!card) throw new Error("Card not found");

  const boxBefore = current?.box ?? 1;
  const now = new Date();
  const next = applyGrade(boxBefore, grade, now, zone);

  const { error: stateErr } = await supabase.from("card_review_state").upsert(
    {
      card_id: cardId,
      user_id: user.id,
      mode,
      box: next.box,
      due_at: next.dueAt.toISOString(),
      lapses: (current?.lapses ?? 0) + next.lapseDelta,
      agreement_fails: (current?.agreement_fails ?? 0) + next.agreementDelta,
      last_grade: grade,
      last_reviewed_at: now.toISOString(),
    },
    { onConflict: "card_id,mode" },
  );
  if (stateErr) throw stateErr;

  // Append-only diagnostic record. frame_tag is denormalised on purpose.
  // The timezone write rides alongside so the SQL day-boundary (the new-card
  // throttle) tracks the learner too, and self-heals if they travel.
  const [{ error: eventErr }] = await Promise.all([
    supabase.from("review_events").insert({
      user_id: user.id,
      card_id: cardId,
      mode,
      grade,
      frame_tag: card.frame_tag ?? "untagged",
      box_before: boxBefore,
      box_after: next.box,
      reviewed_at: now.toISOString(),
    }),
    supabase
      .from("user_settings")
      .update({ timezone: zone })
      .eq("user_id", user.id)
      .neq("timezone", zone),
  ]);
  if (eventErr) throw eventErr;

  revalidatePath("/");
  return { ok: true, box: next.box, dueAt: next.dueAt.toISOString() };
}
