import type { Attempt, ConfusableSet, Letter, Mark, Word } from "./types";

// Database row shapes and their mapping. Shared by the server loaders and the
// browser-side upload queue, so it must stay free of server-only imports.

export const LETTER_COLUMNS = "char, label, grid_row, grid_col, rare, pending_family_check, unlocked";
export const MARK_COLUMNS = "mark, label, sort, unlocked";
export const SET_COLUMNS = "id, kind, chars, description";
export const WORD_COLUMNS = "id, gurmukhi, reading, options, source_card_id, added_week";
export const ATTEMPT_COLUMNS =
  "id, session_id, attempted_at, item_id, item_type, shown, correct_label, picked_label, picked_char, picked_shown, correct, recognition_ms, pick_ms";

export type LetterRow = {
  char: string;
  label: string;
  grid_row: number;
  grid_col: number;
  rare: boolean;
  pending_family_check: boolean;
  unlocked: boolean;
};
export type MarkRow = { mark: string; label: string; sort: number; unlocked: boolean };
export type SetRow = { id: string; kind: string; chars: string[]; description: string };
export type WordRow = {
  id: string;
  gurmukhi: string;
  reading: string;
  options: string[];
  source_card_id: string | null;
  added_week: number | null;
};
export type AttemptRow = {
  id: string;
  session_id: string;
  attempted_at: string;
  item_id: string;
  item_type: Attempt["itemType"];
  shown: string;
  correct_label: string;
  picked_label: string;
  picked_char: string | null;
  picked_shown: string | null;
  correct: boolean;
  recognition_ms: number;
  pick_ms: number;
};

export const fromLetterRow = (r: LetterRow): Letter => ({
  char: r.char,
  label: r.label,
  row: r.grid_row,
  col: r.grid_col,
  rare: r.rare,
  pendingFamilyCheck: r.pending_family_check,
  unlocked: r.unlocked,
});

export const toLetterRow = (l: Letter): LetterRow => ({
  char: l.char,
  label: l.label,
  grid_row: l.row,
  grid_col: l.col,
  rare: l.rare,
  pending_family_check: l.pendingFamilyCheck,
  unlocked: l.unlocked,
});

export const fromMarkRow = (r: MarkRow): Mark => ({ ...r });

export const fromSetRow = (r: SetRow): ConfusableSet => ({ ...r, chars: r.chars ?? [] });

export const fromWordRow = (r: WordRow): Word => ({
  id: r.id,
  gurmukhi: r.gurmukhi,
  reading: r.reading,
  options: r.options ?? [],
  sourceCardId: r.source_card_id,
  addedWeek: r.added_week,
});

export const fromAttemptRow = (r: AttemptRow): Attempt => ({
  attemptId: r.id,
  sessionId: r.session_id,
  timestamp: r.attempted_at,
  itemId: r.item_id,
  itemType: r.item_type,
  shown: r.shown,
  correctLabel: r.correct_label,
  pickedLabel: r.picked_label,
  pickedChar: r.picked_char,
  pickedShown: r.picked_shown,
  correct: r.correct,
  recognitionMs: r.recognition_ms,
  pickMs: r.pick_ms,
});

export const toAttemptRow = (a: Attempt): AttemptRow => ({
  id: a.attemptId,
  session_id: a.sessionId,
  attempted_at: a.timestamp,
  item_id: a.itemId,
  item_type: a.itemType,
  shown: a.shown,
  correct_label: a.correctLabel,
  picked_label: a.pickedLabel,
  picked_char: a.pickedChar,
  picked_shown: a.pickedShown,
  correct: a.correct,
  recognition_ms: a.recognitionMs,
  pick_ms: a.pickMs,
});
