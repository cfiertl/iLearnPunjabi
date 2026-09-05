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
