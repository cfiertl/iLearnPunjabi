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

/**
 * Which script leads on a card, and which one cloze blanks.
 *
 * `roman_primary` is the default: romanisation large, Gurmukhi small beneath,
 * and cloze blanks the romanised token. `gurmukhi_primary` inverts that, and is
 * for once the script is actually readable.
 */
export type ScriptMode = "roman_primary" | "gurmukhi_primary";

export function isScriptMode(value: unknown): value is ScriptMode {
  return value === "roman_primary" || value === "gurmukhi_primary";
}

export type SessionPrefs = {
  sessionCap: number;
  newPerDay: number;
  flipDelayMs: number;
  scriptMode: ScriptMode;
};

/** The sentence and slot index cloze operates on, for the current mode. */
export function primaryText(
  card: {
    roman: string;
    gurmukhi: string;
    slotIndexRoman: number | null;
    slotIndexGurmukhi: number | null;
  },
  scriptMode: ScriptMode,
): { text: string; slotIndex: number | null } {
  return scriptMode === "gurmukhi_primary"
    ? { text: card.gurmukhi, slotIndex: card.slotIndexGurmukhi }
    : { text: card.roman, slotIndex: card.slotIndexRoman };
}

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

/**
 * Can this card be clozed in the current script mode?
 *
 * A card whose slot cannot be located in the script being displayed would show
 * its own answer on the front, so it must be excluded from the queue. Note the
 * answer differs per mode: `agreementSlot` holds the romanised token, so for
 * Gurmukhi only the stored index can resolve it.
 */
export function isClozeable(card: TrainerCard, scriptMode: ScriptMode): boolean {
  const { text, slotIndex } = primaryText(card, scriptMode);
  return resolveSlotIndex(text, slotIndex, card.agreementSlot) !== null;
}
