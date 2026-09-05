import { KNOWN_FRAME_TAGS } from "@/lib/frame-tags";
import { tokenize } from "@/lib/study/types";

/** A card as it appears in an import file (no id/createdAt/active — generated). */
export type ImportedCard = {
  englishPrompt: string;
  gurmukhi: string;
  roman: string;
  frameTag: string;
  agreementSlot: string | null;
  slotIndexRoman: number | null;
  slotIndexGurmukhi: number | null;
  notes: string | null;
};

export type ParseResult = {
  cards: ImportedCard[];
  errors: string[];
  /** frameTag values outside the known list — a warning, never a rejection. */
  unknownTags: string[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function idx(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Parse and validate a pasted JSON array of cards.
 *
 * Unknown frame tags are reported as warnings, not errors — the deck should be
 * able to grow structures the reference table has not caught up with.
 */
export function parseImport(raw: string): ParseResult {
  const errors: string[] = [];
  const cards: ImportedCard[] = [];
  const unknown = new Set<string>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { cards: [], errors: ["That is not valid JSON."], unknownTags: [] };
  }

  if (!Array.isArray(parsed)) {
    return { cards: [], errors: ["Expected a JSON array of cards."], unknownTags: [] };
  }

  parsed.forEach((entry, i) => {
    const at = `Card ${i + 1}`;
    if (typeof entry !== "object" || entry === null) {
      errors.push(`${at}: not an object.`);
      return;
    }
    const o = entry as Record<string, unknown>;

    const englishPrompt = str(o.englishPrompt);
    const gurmukhi = str(o.gurmukhi);
    const roman = str(o.roman);
    const frameTag = str(o.frameTag);

    const missing = [
      !englishPrompt && "englishPrompt",
      !gurmukhi && "gurmukhi",
      !roman && "roman",
      !frameTag && "frameTag",
    ].filter(Boolean);
    if (missing.length) {
      errors.push(`${at}: missing ${missing.join(", ")}.`);
      return;
    }

    if (!KNOWN_FRAME_TAGS.includes(frameTag!)) unknown.add(frameTag!);

    const agreementSlot = str(o.agreementSlot);
    let slotIndexRoman = idx(o.slotIndexRoman);
    let slotIndexGurmukhi = idx(o.slotIndexGurmukhi);

    // A slot index that points past the end of its sentence would silently
    // break cloze rendering, so drop it rather than store something bogus.
    if (slotIndexRoman !== null && slotIndexRoman >= tokenize(roman!).length) {
      errors.push(`${at}: slotIndexRoman ${slotIndexRoman} is past the end of the sentence.`);
      slotIndexRoman = null;
    }
    if (
      slotIndexGurmukhi !== null &&
      slotIndexGurmukhi >= tokenize(gurmukhi!).length
    ) {
      errors.push(
        `${at}: slotIndexGurmukhi ${slotIndexGurmukhi} is past the end of the sentence.`,
      );
      slotIndexGurmukhi = null;
    }

    cards.push({
      englishPrompt: englishPrompt!,
      gurmukhi: gurmukhi!,
      roman: roman!,
      frameTag: frameTag!,
      agreementSlot,
      slotIndexRoman,
      slotIndexGurmukhi,
      notes: str(o.notes),
    });
  });

  return { cards, errors, unknownTags: [...unknown] };
}

/** Import identity: same prompt + same sentence = same card. */
export function importKey(englishPrompt: string, gurmukhi: string): string {
  return `${englishPrompt.trim()}\u0000${gurmukhi.trim()}`;
}
