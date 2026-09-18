// Gurmukhi recognition drill: shared types and tuning constants.
//
// The drill is fully separate from the Leitner deck. Nothing in
// src/lib/gurmukhi reads or writes cards, card_review_state or review_events.

export type ItemType = "letter" | "syllable" | "word";

export type Letter = {
  char: string;
  label: string;
  row: number;
  col: number;
  rare: boolean;
  pendingFamilyCheck: boolean;
  unlocked: boolean;
};

export type Mark = {
  mark: string;
  label: string;
  sort: number;
  unlocked: boolean;
};

export type ConfusableSet = {
  id: string;
  kind: string;
  chars: string[];
  description: string;
};

export type Word = {
  id: string;
  gurmukhi: string;
  reading: string;
  /** The three authored distractors. */
  options: string[];
  sourceCardId: string | null;
  addedWeek: number | null;
};

/** Everything the drill needs to run, offline included. */
export type DrillContent = {
  letters: Letter[];
  marks: Mark[];
  sets: ConfusableSet[];
  words: Word[];
};

export type Attempt = {
  attemptId: string;
  sessionId: string;
  timestamp: string;
  itemId: string;
  itemType: ItemType;
  shown: string;
  correctLabel: string;
  pickedLabel: string;
  /** Letter items only. */
  pickedChar: string | null;
  /** Gurmukhi of the picked option, for letters and syllables. */
  pickedShown: string | null;
  correct: boolean;
  recognitionMs: number;
  pickMs: number;
};

export type Item = {
  id: string;
  type: ItemType;
  /** The Gurmukhi on screen. */
  shown: string;
  label: string;
  /** The consonant a letter or syllable is built on; null for words. */
  consonant: string | null;
  mark: string | null;
  rare: boolean;
};

export type Option = {
  label: string;
  /** Gurmukhi for letter and syllable options; null for words. */
  shown: string | null;
};

// --- Tuning ---------------------------------------------------------------

export const SESSION_LENGTH = 20;
export const OPTION_COUNT = 4;

/** weight = (1 + ERROR_WEIGHT * recent_errors + slow + new) * rare_factor */
export const ERROR_WEIGHT = 2;
export const RECENT_WINDOW = 5;
export const NEW_THRESHOLD = 3;
/** Items need this many attempts to count toward the slowest-quarter cutoff. */
export const SLOW_MIN_ATTEMPTS = 3;
export const SLOW_QUANTILE = 0.25;
export const RARE_FACTOR = 0.25;

/** Share of a session per item type, while no words exist and once they do. */
export const MIX_WITHOUT_WORDS = { letter: 0.7, syllable: 0.3, word: 0 };
export const MIX_WITH_WORDS = { letter: 0.4, syllable: 0.3, word: 0.3 };

/** Stats: per-item median over this many recent attempts. */
export const STATS_WINDOW = 10;
/** Stats: an out-of-set pair confused this often becomes a candidate. */
export const CANDIDATE_MIN = 3;

/** Row 1 vowel carriers never take a mark in generated syllables. */
export const VOWEL_CARRIERS = ["ੳ", "ਅ", "ੲ"];

/** The Say stage shows "Palm check" when an item starts with one of these. */
export const PALM_CHECK_LETTERS = ["ਖ", "ਛ", "ਠ", "ਥ", "ਫ"];

export const ITEM_KIND = {
  letter: (char: string) => `letter:${char}`,
  // Consonant then mark, always: ਿ renders to the left, but the font does that.
  syllable: (consonant: string, mark: string) => `syllable:${consonant}${mark}`,
  word: (id: string) => `word:${id}`,
};
