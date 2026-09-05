import type { Box, ReviewMode } from "@/lib/leitner";

/**
 * A sentence card as shipped to the browser.
 *
 * Gurmukhi IS included and IS displayed: per the build spec the script is the
 * primary display on card backs, because romanisation cannot represent
 * aspiration or tone and the learner trains script recognition in parallel.
 */
export type TrainerCard = {
  id: string;
  englishPrompt: string;
  gurmukhi: string;
  roman: string;
  frameTag: string;
  agreementSlot: string | null;
  slotIndexRoman: number | null;
  slotIndexGurmukhi: number | null;
  notes: string | null;
  audioUrl: string | null;
  audioSpeaker: string | null;
  box: Box;
};

export type SessionPrefs = {
  sessionCap: number;
  newPerDay: number;
  flipDelayMs: number;
};

export type { ReviewMode };

/** Whitespace tokens of a sentence — the unit `slotIndex*` points into. */
export function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/**
 * Locate the agreement slot in a sentence.
 *
 * Prefers the stored token index, falls back to matching the slot token by
 * text, and returns null when neither works. Callers MUST treat null as
 * "cannot be clozed" — blanking nothing would print the answer on the front of
 * the card.
 */
export function resolveSlotIndex(
  sentence: string,
  slotIndex: number | null,
  slotToken: string | null,
): number | null {
  const parts = tokenize(sentence);
  if (slotIndex !== null && slotIndex >= 0 && slotIndex < parts.length) {
    return slotIndex;
  }
  if (slotToken) {
    const found = parts.indexOf(slotToken.trim());
    if (found >= 0) return found;
  }
  return null;
}

/**
 * Replace the agreement slot with a visible blank.
 * Falls back to the untouched sentence when the index is missing or stale.
 */
export function blankSlot(
  sentence: string,
  slotIndex: number | null,
  blank = "____",
): string {
  const parts = tokenize(sentence);
  if (slotIndex === null || slotIndex < 0 || slotIndex >= parts.length) {
    return sentence;
  }
  parts[slotIndex] = blank;
  return parts.join(" ");
}
