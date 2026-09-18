import type { ConfusableSet, DrillContent, Letter, Word } from "@/lib/gurmukhi/types";

// The optional `gurmukhi` section of a session file: the only way drill content
// changes after seeding. Checked with the same all-or-nothing rules as the rest
// of the file — problems are collected, and any error means nothing is written.
//
//   unlockMarks        ["ੁ", "ੂ"]                        one way: no lock action
//   unlockLetters      ["ਸ਼"]
//   addLetters         [{char, label, row, col, rare?, pendingFamilyCheck?}]
//                      added locked, or updated by char (unlock state kept)
//   labelUpdates       [{char, label?, pendingFamilyCheck?}]   letters or marks
//   addConfusableSets  [{id, kind, chars, description}]   added or updated by id
//   addWords           [{id, gurmukhi, reading, options, sourceCardId?, addedWeek?}]
//                      added or updated by id; options are exactly 3 distractors

export const GURMUKHI_KEYS = [
  "unlockMarks",
  "unlockLetters",
  "addLetters",
  "labelUpdates",
  "addConfusableSets",
  "addWords",
] as const;

export const SET_KINDS = ["column", "place", "shape"];
export const WORD_DISTRACTORS = 3;

/** What `apply_session_import` receives under `gurmukhi`. snake_case for SQL. */
export type GurmukhiPlan = {
  letters_upsert: {
    char: string;
    label: string;
    row: number;
    col: number;
    rare: boolean;
    pending_family_check: boolean;
  }[];
  letter_labels: { char: string; label?: string; pending_family_check?: boolean }[];
  mark_labels: { mark: string; label: string }[];
  unlock_letters: string[];
  unlock_marks: string[];
  sets_upsert: ConfusableSet[];
  words_upsert: {
    id: string;
    gurmukhi: string;
    reading: string;
    options: string[];
    source_card_id: string | null;
    added_week: number | null;
  }[];
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const positiveInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0;

/** An array section, or [] when absent. Anything else is an error. */
function list(section: Record<string, unknown>, key: string, errors: string[]): unknown[] {
  const v = section[key];
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    errors.push(`gurmukhi.${key} must be an array.`);
    return [];
  }
  return v;
}

export function validateGurmukhi(
  section: unknown,
  content: DrillContent,
  knownCardIds: Set<string>,
  errors: string[],
  warnings: string[],
): { changes: string[]; plan: GurmukhiPlan } {
  const changes: string[] = [];
  const plan: GurmukhiPlan = {
    letters_upsert: [],
    letter_labels: [],
    mark_labels: [],
    unlock_letters: [],
    unlock_marks: [],
    sets_upsert: [],
    words_upsert: [],
  };

  if (!isObject(section)) {
    errors.push("gurmukhi must be an object.");
    return { changes, plan };
  }
  for (const key of Object.keys(section)) {
    if (!(GURMUKHI_KEYS as readonly string[]).includes(key)) {
      warnings.push(`gurmukhi.${key} is not a known key and was ignored.`);
    }
  }

  // Letters as they will be after this file, so later sections can refer to a
  // letter an earlier one adds.
  const letters = new Map<string, Letter>(content.letters.map((l) => [l.char, { ...l }]));
  const marks = new Map(content.marks.map((m) => [m.mark, { ...m }]));

  // --- addLetters -----------------------------------------------------------
  const addedChars = new Set<string>();
  list(section, "addLetters", errors).forEach((entry, i) => {
    const at = `gurmukhi.addLetters[${i}]`;
    if (!isObject(entry)) return void errors.push(`${at}: not an object.`);
    const char = text(entry.char);
    const label = text(entry.label);
    if (!char || !label) return void errors.push(`${at}: char and label are required.`);
    const where = `${at} ${char}`;
    if (addedChars.has(char)) errors.push(`${where}: appears twice in addLetters.`);
    addedChars.add(char);
    if (marks.has(char)) return void errors.push(`${where}: is a vowel mark, not a letter.`);
    if (!positiveInt(entry.row) || !positiveInt(entry.col)) {
      return void errors.push(`${where}: row and col must be positive whole numbers.`);
    }
    for (const flag of ["rare", "pendingFamilyCheck"] as const) {
      if (entry[flag] !== undefined && typeof entry[flag] !== "boolean") {
        errors.push(`${where}: ${flag} must be true or false.`);
      }
    }

    const existing = letters.get(char);
    const next: Letter = {
      char,
      label,
      row: entry.row as number,
      col: entry.col as number,
      rare: typeof entry.rare === "boolean" ? entry.rare : (existing?.rare ?? false),
      pendingFamilyCheck:
        typeof entry.pendingFamilyCheck === "boolean"
          ? entry.pendingFamilyCheck
          : (existing?.pendingFamilyCheck ?? false),
      unlocked: existing?.unlocked ?? false,
    };
    letters.set(char, next);
    plan.letters_upsert.push({
      char,
      label,
      row: next.row,
      col: next.col,
      rare: next.rare,
      pending_family_check: next.pendingFamilyCheck,
    });

    if (!existing) {
      changes.push(`Add letter ${char} “${label}” (row ${next.row}, col ${next.col}), locked`);
    } else {
      const diffs = [
        existing.label !== next.label && `label ${existing.label} → ${next.label}`,
        (existing.row !== next.row || existing.col !== next.col) &&
          `position ${existing.row},${existing.col} → ${next.row},${next.col}`,
        existing.rare !== next.rare && `rare ${existing.rare} → ${next.rare}`,
        existing.pendingFamilyCheck !== next.pendingFamilyCheck &&
          `family check ${existing.pendingFamilyCheck ? "pending" : "cleared"} → ${next.pendingFamilyCheck ? "pending" : "cleared"}`,
      ].filter(Boolean);
      if (diffs.length) changes.push(`Update letter ${char}: ${diffs.join(", ")}`);
      else warnings.push(`${where}: changes nothing.`);
    }
  });

  // --- labelUpdates ---------------------------------------------------------
  const relabelled = new Set<string>();
  list(section, "labelUpdates", errors).forEach((entry, i) => {
    const at = `gurmukhi.labelUpdates[${i}]`;
    if (!isObject(entry)) return void errors.push(`${at}: not an object.`);
    const char = text(entry.char);
    if (!char) return void errors.push(`${at}: char is required.`);
    const where = `${at} ${char}`;
    if (relabelled.has(char)) errors.push(`${where}: appears twice in labelUpdates.`);
    relabelled.add(char);

    const hasLabel = entry.label !== undefined;
    const hasFlag = entry.pendingFamilyCheck !== undefined;
    const label = text(entry.label);
    if (!hasLabel && !hasFlag) return void errors.push(`${where}: give label, pendingFamilyCheck, or both.`);
    if (hasLabel && !label) return void errors.push(`${where}: label cannot be empty.`);
    if (hasFlag && typeof entry.pendingFamilyCheck !== "boolean") {
      return void errors.push(`${where}: pendingFamilyCheck must be true or false.`);
    }

    const mark = marks.get(char);
    if (mark) {
      if (hasFlag) return void errors.push(`${where}: vowel marks have no pendingFamilyCheck.`);
      if (mark.label === label) return void warnings.push(`${where}: changes nothing.`);
      changes.push(`Relabel mark ${char}: ${mark.label} → ${label}`);
      mark.label = label!;
      plan.mark_labels.push({ mark: char, label: label! });
      return;
    }

    const letter = letters.get(char);
    if (!letter) return void errors.push(`${where}: no letter or mark with this character.`);
    const diffs: string[] = [];
    const update: GurmukhiPlan["letter_labels"][number] = { char };
    if (hasLabel && label !== letter.label) {
      diffs.push(`${letter.label} → ${label}`);
      letter.label = label!;
      update.label = label!;
    }
    if (hasFlag && entry.pendingFamilyCheck !== letter.pendingFamilyCheck) {
      diffs.push(entry.pendingFamilyCheck ? "family check pending" : "family check cleared");
      letter.pendingFamilyCheck = entry.pendingFamilyCheck as boolean;
      update.pending_family_check = letter.pendingFamilyCheck;
    }
    if (!diffs.length) return void warnings.push(`${where}: changes nothing.`);
    changes.push(`Relabel letter ${char}: ${diffs.join(", ")}`);
    plan.letter_labels.push(update);
  });

  // --- unlocks --------------------------------------------------------------
  const unlock = (key: "unlockLetters" | "unlockMarks") => {
    const isLetter = key === "unlockLetters";
    const seen = new Set<string>();
    list(section, key, errors).forEach((raw, i) => {
      const at = `gurmukhi.${key}[${i}]`;
      const char = text(raw);
      if (!char) return void errors.push(`${at}: must be a character.`);
      if (seen.has(char)) return;
      seen.add(char);
      const target = isLetter ? letters.get(char) : marks.get(char);
      if (!target) {
        return void errors.push(`${at}: no ${isLetter ? "letter" : "vowel mark"} ${char}.`);
      }
      if (target.unlocked) return void warnings.push(`${at}: ${char} is already unlocked.`);
      target.unlocked = true;
      (isLetter ? plan.unlock_letters : plan.unlock_marks).push(char);
      changes.push(`Unlock ${isLetter ? "letter" : "mark"} ${char} “${target.label}”`);
    });
  };
  unlock("unlockLetters");
  unlock("unlockMarks");

  for (const char of addedChars) {
    if (!letters.get(char)?.unlocked && !content.letters.some((l) => l.char === char)) {
      warnings.push(`gurmukhi.addLetters ${char}: added but not unlocked, so it will not be drilled yet.`);
    }
  }

  // Two unlocked letters reading the same would make options indistinguishable.
  const byLabel = new Map<string, string[]>();
  for (const l of letters.values()) {
    if (!l.unlocked) continue;
    byLabel.set(l.label, [...(byLabel.get(l.label) ?? []), l.char]);
  }
  for (const [label, chars] of byLabel) {
    const before = content.letters.filter((l) => l.unlocked && l.label === label).length;
    if (chars.length > 1 && chars.length > before) {
      warnings.push(`Letters ${chars.join(" ")} would all read “${label}”; only one can appear per question.`);
    }
  }

  // --- addConfusableSets ----------------------------------------------------
  const existingSets = new Map(content.sets.map((s) => [s.id, s]));
  const setIds = new Set<string>();
  list(section, "addConfusableSets", errors).forEach((entry, i) => {
    const at = `gurmukhi.addConfusableSets[${i}]`;
    if (!isObject(entry)) return void errors.push(`${at}: not an object.`);
    const id = text(entry.id);
    const kind = text(entry.kind);
    const description = text(entry.description);
    if (!id || !kind || !description) {
      return void errors.push(`${at}: id, kind and description are required.`);
    }
    const where = `${at} ${id}`;
    if (setIds.has(id)) errors.push(`${where}: appears twice in addConfusableSets.`);
    setIds.add(id);
    if (!SET_KINDS.includes(kind)) {
      warnings.push(`${where}: kind “${kind}” is not one of ${SET_KINDS.join(", ")} (imported anyway).`);
    }
    if (!Array.isArray(entry.chars)) return void errors.push(`${where}: chars must be an array.`);
    const chars = [...new Set(entry.chars.map(text))];
    if (chars.some((c) => c === null)) return void errors.push(`${where}: every char must be a string.`);
    if (chars.length < 2) return void errors.push(`${where}: needs at least two different letters.`);
    const unknown = (chars as string[]).filter((c) => !letters.has(c));
    if (unknown.length) return void errors.push(`${where}: unknown letters ${unknown.join(" ")}.`);

    const set: ConfusableSet = { id, kind, chars: chars as string[], description };
    plan.sets_upsert.push(set);
    const old = existingSets.get(id);
    if (!old) {
      changes.push(`Add confusable set ${id} (${kind}): ${set.chars.join(" ")} — ${description}`);
    } else if (
      old.kind === kind &&
      old.description === description &&
      old.chars.join() === set.chars.join()
    ) {
      warnings.push(`${where}: changes nothing.`);
    } else {
      changes.push(`Update confusable set ${id}: ${old.chars.join(" ")} → ${set.chars.join(" ")} — ${description}`);
    }
  });

  // --- addWords -------------------------------------------------------------
  const existingWords = new Map<string, Word>(content.words.map((w) => [w.id, w]));
  const wordIds = new Set<string>();
  list(section, "addWords", errors).forEach((entry, i) => {
    const at = `gurmukhi.addWords[${i}]`;
    if (!isObject(entry)) return void errors.push(`${at}: not an object.`);
    const id = text(entry.id);
    const gurmukhi = text(entry.gurmukhi);
    const reading = text(entry.reading);
    if (!id || !gurmukhi || !reading) {
      return void errors.push(`${at}: id, gurmukhi and reading are required.`);
    }
    const where = `${at} ${id}`;
    if (wordIds.has(id)) errors.push(`${where}: appears twice in addWords.`);
    wordIds.add(id);

    if (!Array.isArray(entry.options) || entry.options.some((o) => !text(o))) {
      return void errors.push(`${where}: options must be an array of readings.`);
    }
    const options = entry.options.map((o) => text(o)!);
    if (options.length !== WORD_DISTRACTORS || new Set(options).size !== WORD_DISTRACTORS) {
      return void errors.push(`${where}: options must be exactly ${WORD_DISTRACTORS} different distractors.`);
    }
    if (options.includes(reading)) {
      return void errors.push(`${where}: options must not include the reading itself.`);
    }

    let sourceCardId: string | null = null;
    if (entry.sourceCardId !== undefined && entry.sourceCardId !== null) {
      sourceCardId = text(entry.sourceCardId);
      if (!sourceCardId) return void errors.push(`${where}: sourceCardId must be a string or null.`);
      if (!knownCardIds.has(sourceCardId)) {
        warnings.push(`${where}: sourceCardId ${sourceCardId} is not a card in the deck (kept as a note).`);
      }
    }
    let addedWeek: number | null = null;
    if (entry.addedWeek !== undefined && entry.addedWeek !== null) {
      if (typeof entry.addedWeek !== "number" || !Number.isInteger(entry.addedWeek) || entry.addedWeek < 0) {
        return void errors.push(`${where}: addedWeek must be a whole number or null.`);
      }
      addedWeek = entry.addedWeek;
    }

    plan.words_upsert.push({
      id,
      gurmukhi,
      reading,
      options,
      source_card_id: sourceCardId,
      added_week: addedWeek,
    });
    const old = existingWords.get(id);
    const summary = `${gurmukhi} “${reading}” (options: ${options.join(", ")})`;
    if (!old) changes.push(`Add word ${id}: ${summary}`);
    else if (
      old.gurmukhi === gurmukhi &&
      old.reading === reading &&
      old.options.join() === options.join() &&
      old.sourceCardId === sourceCardId &&
      old.addedWeek === addedWeek
    ) {
      warnings.push(`${where}: changes nothing.`);
    } else changes.push(`Update word ${id}: ${summary}`);
  });

  return { changes, plan };
}
