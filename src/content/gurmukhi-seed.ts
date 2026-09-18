import type { ConfusableSet, Letter, Mark } from "@/lib/gurmukhi/types";

// Seed for the Gurmukhi recognition drill. Written to the database once per
// user on first use; after that every change arrives through the session
// import, so editing this file does not change an existing database.
//
// Romanisation: a capital marks retroflex (T, Th, D, Dh, N, L) and h after a
// consonant marks aspiration. Column 4 of rows 2-6 is pendingFamilyCheck: it
// may be tone rather than aspiration in the family's speech.
//
// Dotted letters (ਸ਼ ਖ਼ ਫ਼ ਜ਼ ਕ਼) are deliberately absent; they arrive by import.

type SeedLetter = Omit<Letter, "rare" | "pendingFamilyCheck" | "unlocked"> & {
  rare?: boolean;
  pendingFamilyCheck?: boolean;
};

const LETTERS: SeedLetter[] = [
  { char: "ੳ", label: "u", row: 1, col: 1 },
  { char: "ਅ", label: "a", row: 1, col: 2 },
  { char: "ੲ", label: "i", row: 1, col: 3 },
  { char: "ਸ", label: "s", row: 1, col: 4 },
  { char: "ਹ", label: "h", row: 1, col: 5 },

  { char: "ਕ", label: "k", row: 2, col: 1 },
  { char: "ਖ", label: "kh", row: 2, col: 2 },
  { char: "ਗ", label: "g", row: 2, col: 3 },
  { char: "ਘ", label: "gh", row: 2, col: 4, pendingFamilyCheck: true },
  { char: "ਙ", label: "ng", row: 2, col: 5, rare: true },

  { char: "ਚ", label: "ch", row: 3, col: 1 },
  { char: "ਛ", label: "chh", row: 3, col: 2 },
  { char: "ਜ", label: "j", row: 3, col: 3 },
  { char: "ਝ", label: "jh", row: 3, col: 4, pendingFamilyCheck: true },
  { char: "ਞ", label: "ny", row: 3, col: 5, rare: true },

  { char: "ਟ", label: "T", row: 4, col: 1 },
  { char: "ਠ", label: "Th", row: 4, col: 2 },
  { char: "ਡ", label: "D", row: 4, col: 3 },
  { char: "ਢ", label: "Dh", row: 4, col: 4, pendingFamilyCheck: true },
  { char: "ਣ", label: "N", row: 4, col: 5 },

  { char: "ਤ", label: "t", row: 5, col: 1 },
  { char: "ਥ", label: "th", row: 5, col: 2 },
  { char: "ਦ", label: "d", row: 5, col: 3 },
  { char: "ਧ", label: "dh", row: 5, col: 4, pendingFamilyCheck: true },
  { char: "ਨ", label: "n", row: 5, col: 5 },

  { char: "ਪ", label: "p", row: 6, col: 1 },
  { char: "ਫ", label: "ph", row: 6, col: 2 },
  { char: "ਬ", label: "b", row: 6, col: 3 },
  { char: "ਭ", label: "bh", row: 6, col: 4, pendingFamilyCheck: true },
  { char: "ਮ", label: "m", row: 6, col: 5 },

  { char: "ਯ", label: "y", row: 7, col: 1 },
  { char: "ਰ", label: "r", row: 7, col: 2 },
  { char: "ਲ", label: "l", row: 7, col: 3 },
  { char: "ਵ", label: "v", row: 7, col: 4 },
  { char: "ਲ਼", label: "L", row: 7, col: 5, rare: true },
];

/** Every seeded letter starts unlocked: the whole grid is in play from day one. */
export const SEED_LETTERS: Letter[] = LETTERS.map((l) => ({
  ...l,
  rare: l.rare ?? false,
  pendingFamilyCheck: l.pendingFamilyCheck ?? false,
  unlocked: true,
}));

/** ਾ ਿ ੀ taught Week 2 Thursday; the rest wait for an import to unlock them. */
export const SEED_MARKS: Mark[] = [
  { mark: "ਾ", label: "aa", unlocked: true },
  { mark: "ਿ", label: "i", unlocked: true },
  { mark: "ੀ", label: "ee", unlocked: true },
  { mark: "ੁ", label: "u", unlocked: false },
  { mark: "ੂ", label: "oo", unlocked: false },
  { mark: "ੇ", label: "e", unlocked: false },
  { mark: "ੈ", label: "ai", unlocked: false },
  { mark: "ੋ", label: "o", unlocked: false },
  { mark: "ੌ", label: "au", unlocked: false },
].map((m, sort) => ({ ...m, sort }));

/** The shape list is deliberately short; it grows from real confusions. */
export const SEED_SETS: ConfusableSet[] = [
  { id: "col_k", kind: "column", chars: ["ਕ", "ਖ", "ਗ", "ਘ"], description: "aspiration and voicing" },
  { id: "col_ch", kind: "column", chars: ["ਚ", "ਛ", "ਜ", "ਝ"], description: "aspiration and voicing" },
  { id: "col_T", kind: "column", chars: ["ਟ", "ਠ", "ਡ", "ਢ"], description: "aspiration and voicing" },
  { id: "col_t", kind: "column", chars: ["ਤ", "ਥ", "ਦ", "ਧ"], description: "aspiration and voicing" },
  { id: "col_p", kind: "column", chars: ["ਪ", "ਫ", "ਬ", "ਭ"], description: "aspiration and voicing" },
  { id: "carriers", kind: "column", chars: ["ੳ", "ਅ", "ੲ"], description: "vowel carriers" },

  { id: "place_T_t", kind: "place", chars: ["ਟ", "ਤ"], description: "retroflex vs dental" },
  { id: "place_Th_th", kind: "place", chars: ["ਠ", "ਥ"], description: "retroflex vs dental" },
  { id: "place_D_d", kind: "place", chars: ["ਡ", "ਦ"], description: "retroflex vs dental" },
  { id: "place_Dh_dh", kind: "place", chars: ["ਢ", "ਧ"], description: "retroflex vs dental" },
  { id: "place_N_n", kind: "place", chars: ["ਣ", "ਨ"], description: "retroflex vs dental" },

  { id: "shape_gh_dh", kind: "shape", chars: ["ਘ", "ਧ"], description: "similar shape" },
  { id: "shape_m_s", kind: "shape", chars: ["ਮ", "ਸ"], description: "similar shape" },
  { id: "shape_kh_th", kind: "shape", chars: ["ਖ", "ਥ"], description: "similar shape" },
];
