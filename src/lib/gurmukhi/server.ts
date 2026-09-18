import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SEED_LETTERS, SEED_MARKS, SEED_SETS } from "@/content/gurmukhi-seed";
import { computeStats, type GurmukhiStats } from "./stats";
import {
  ATTEMPT_COLUMNS,
  LETTER_COLUMNS,
  MARK_COLUMNS,
  SET_COLUMNS,
  WORD_COLUMNS,
  fromAttemptRow,
  fromLetterRow,
  fromMarkRow,
  fromSetRow,
  fromWordRow,
  toLetterRow,
  type AttemptRow,
  type LetterRow,
  type MarkRow,
  type SetRow,
  type WordRow,
} from "./rows";
import type { Attempt, DrillContent } from "./types";

/** How much history the drill carries for weighting. Well past 5 per item. */
const DRILL_HISTORY_LIMIT = 1500;

/**
 * Seed letters, marks and sets on first use. Each table is checked on its own,
 * and duplicates are ignored, so a half-finished seed completes and an
 * imported change is never overwritten.
 */
export async function ensureGurmukhiSeed(supabase: SupabaseClient, userId: string) {
  const [letters, marks, sets] = await Promise.all([
    supabase.from("gurmukhi_letters").select("char").limit(1),
    supabase.from("gurmukhi_marks").select("mark").limit(1),
    supabase.from("gurmukhi_sets").select("id").limit(1),
  ]);
  for (const r of [letters, marks, sets]) if (r.error) throw r.error;

  const writes = [];
  if (!letters.data?.length) {
    writes.push(
      supabase
        .from("gurmukhi_letters")
        .upsert(SEED_LETTERS.map((l) => ({ user_id: userId, ...toLetterRow(l) })), {
          onConflict: "user_id,char",
          ignoreDuplicates: true,
        }),
    );
  }
  if (!marks.data?.length) {
    writes.push(
      supabase
        .from("gurmukhi_marks")
        .upsert(SEED_MARKS.map((m) => ({ user_id: userId, ...m })), {
          onConflict: "user_id,mark",
          ignoreDuplicates: true,
        }),
    );
  }
  if (!sets.data?.length) {
    writes.push(
      supabase
        .from("gurmukhi_sets")
        .upsert(SEED_SETS.map((s) => ({ user_id: userId, ...s })), {
          onConflict: "user_id,id",
          ignoreDuplicates: true,
        }),
    );
  }
  for (const r of await Promise.all(writes)) if (r.error) throw r.error;
}

export async function loadContent(supabase: SupabaseClient): Promise<DrillContent> {
  const [letters, marks, sets, words] = await Promise.all([
    supabase.from("gurmukhi_letters").select(LETTER_COLUMNS).order("grid_row").order("grid_col"),
    supabase.from("gurmukhi_marks").select(MARK_COLUMNS).order("sort"),
    supabase.from("gurmukhi_sets").select(SET_COLUMNS).order("id"),
    supabase.from("gurmukhi_words").select(WORD_COLUMNS).order("id"),
  ]);
  for (const r of [letters, marks, sets, words]) if (r.error) throw r.error;

  return {
    letters: ((letters.data ?? []) as LetterRow[]).map(fromLetterRow),
    marks: ((marks.data ?? []) as MarkRow[]).map(fromMarkRow),
    sets: ((sets.data ?? []) as SetRow[]).map(fromSetRow),
    words: ((words.data ?? []) as WordRow[]).map(fromWordRow),
  };
}

async function loadAttempts(supabase: SupabaseClient, limit?: number): Promise<Attempt[]> {
  // PostgREST caps a single response, so page through rather than trust one read.
  const PAGE = 1000;
  const out: Attempt[] = [];
  for (let from = 0; limit === undefined || from < limit; from += PAGE) {
    const to = limit === undefined ? from + PAGE - 1 : Math.min(from + PAGE, limit) - 1;
    const { data, error } = await supabase
      .from("gurmukhi_attempts")
      .select(ATTEMPT_COLUMNS)
      .order("attempted_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as AttemptRow[];
    out.push(...rows.map(fromAttemptRow));
    if (rows.length < to - from + 1) break;
  }
  return out;
}

export type DrillData = {
  content: DrillContent;
  history: Attempt[];
  palmHint: boolean;
};

/** Everything the drill screen needs, seeding on first use. Null before 0011. */
export async function getDrillData(): Promise<DrillData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    await ensureGurmukhiSeed(supabase, user.id);
    const [content, history, settings] = await Promise.all([
      loadContent(supabase),
      loadAttempts(supabase, DRILL_HISTORY_LIMIT),
      supabase.from("user_settings").select("gurmukhi_palm_hint").maybeSingle(),
    ]);
    return {
      content,
      history,
      palmHint: settings.data?.gurmukhi_palm_hint ?? true,
    };
  } catch (e) {
    console.error("Gurmukhi drill unavailable (has migration 0011 run?)", e);
    return null;
  }
}

/** The Gurmukhi section of the stats view. Null when the tables are missing. */
export async function getGurmukhiStats(): Promise<GurmukhiStats | null> {
  const supabase = await createClient();
  try {
    const [content, attempts] = await Promise.all([
      loadContent(supabase),
      loadAttempts(supabase),
    ]);
    return computeStats(attempts, content);
  } catch {
    return null;
  }
}

/** For the raw export: every attempt, oldest first, and the current content. */
export async function getGurmukhiExport(supabase: SupabaseClient) {
  try {
    const [content, attempts] = await Promise.all([
      loadContent(supabase),
      loadAttempts(supabase),
    ]);
    return { content, attempts: attempts.reverse() };
  } catch {
    return null;
  }
}

export async function getPalmHint(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("gurmukhi_palm_hint").maybeSingle();
  return data?.gurmukhi_palm_hint ?? true;
}
