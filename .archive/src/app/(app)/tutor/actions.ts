"use server";

import {
  anthropic,
  isTutorConfigured,
  TUTOR_MODEL,
  TUTOR_SYSTEM,
} from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/usage/record";
import { chatCost } from "@/lib/pricing";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function sendTutorMessage(
  history: ChatMessage[],
): Promise<{ reply: string } | { error: string }> {
  if (!isTutorConfigured || !anthropic) return { error: "tutor-not-configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // Keep the context bounded (and costs predictable).
  const messages = history
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0) return { error: "empty" };

  try {
    const response = await anthropic.messages.create({
      model: TUTOR_MODEL,
      max_tokens: 1024,
      system: TUTOR_SYSTEM,
      messages,
    });

    const reply = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    await recordUsage(supabase, user.id, {
      kind: "chat",
      provider: "anthropic",
      model: TUTOR_MODEL,
      units: response.usage.input_tokens + response.usage.output_tokens,
      unitType: "tokens",
      costUsd: chatCost(response.usage.input_tokens, response.usage.output_tokens),
    });

    return { reply: reply || "…" };
  } catch {
    return { error: "chat-failed" };
  }
}
