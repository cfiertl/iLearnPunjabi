import {
  ERROR_WEIGHT,
  ITEM_KIND,
  MIX_WITHOUT_WORDS,
  MIX_WITH_WORDS,
  NEW_THRESHOLD,
  OPTION_COUNT,
  RARE_FACTOR,
  RECENT_WINDOW,
  SESSION_LENGTH,
  SLOW_MIN_ATTEMPTS,
  SLOW_QUANTILE,
  VOWEL_CARRIERS,
  type Attempt,
  type ConfusableSet,
  type DrillContent,
  type Item,
  type ItemType,
  type Letter,
  type Option,
} from "./types";

// Pure drill logic: no React, no network, so it runs identically offline.
// Every random choice takes `rng` so the rules can be exercised
// deterministically.

type Rng = () => number;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Items -----------------------------------------------------------------

/**
 * Every drillable item. Syllables are generated: each unlocked consonant
 * (vowel carriers excluded) with each unlocked mark, consonant codepoint
 * first. Words are exactly as authored.
 */
export function buildItems(content: DrillContent): Item[] {
  const letters = content.letters.filter((l) => l.unlocked);
  const marks = content.marks.filter((m) => m.unlocked);
  const items: Item[] = [];

  for (const l of letters) {
    items.push({
      id: ITEM_KIND.letter(l.char),
      type: "letter",
      shown: l.char,
      label: l.label,
      consonant: l.char,
      mark: null,
      rare: l.rare,
    });
  }
  for (const l of letters) {
    if (VOWEL_CARRIERS.includes(l.char)) continue;
    for (const m of marks) {
      items.push({
        id: ITEM_KIND.syllable(l.char, m.mark),
        type: "syllable",
        shown: l.char + m.mark,
        label: l.label + m.label,
        consonant: l.char,
        mark: m.mark,
        rare: l.rare,
      });
    }
  }
  for (const w of content.words) {
    items.push({
      id: ITEM_KIND.word(w.id),
      type: "word",
      shown: w.gurmukhi,
      label: w.reading,
      consonant: null,
      mark: null,
      rare: false,
    });
  }
  return items;
}

/** Split a letter-or-syllable string into its consonant and trailing mark. */
export function splitSyllable(
  shown: string,
  content: Pick<DrillContent, "marks">,
): { consonant: string; mark: string | null } {
  const last = shown.slice(-1);
  if (shown.length > 1 && content.marks.some((m) => m.mark === last)) {
    return { consonant: shown.slice(0, -1), mark: last };
  }
  return { consonant: shown, mark: null };
}

export function setsContaining(char: string, sets: ConfusableSet[]): ConfusableSet[] {
  return sets.filter((s) => s.chars.includes(char));
}

/** Sets that contain both characters: what a confusion between them is "about". */
export function sharedSets(a: string, b: string, sets: ConfusableSet[]): ConfusableSet[] {
  return sets.filter((s) => s.chars.includes(a) && s.chars.includes(b));
}

// --- Distractors -----------------------------------------------------------

/**
 * Candidate confusable letters for `target`, in priority tiers:
 * 1. every set the target belongs to, pooled; 2. the same grid row;
 * 3. any other unlocked letter. Each tier is shuffled on its own, so order
 * within a tier is random but a lower tier is only reached once the one above
 * is used up.
 */
function letterCandidates(target: Letter, content: DrillContent, rng: Rng): Letter[] {
  const unlocked = content.letters.filter((l) => l.unlocked && l.char !== target.char);
  const inSets = new Set(setsContaining(target.char, content.sets).flatMap((s) => s.chars));

  const tier1 = unlocked.filter((l) => inSets.has(l.char));
  const tier2 = unlocked.filter((l) => !inSets.has(l.char) && l.row === target.row);
  const tier3 = unlocked.filter((l) => !inSets.has(l.char) && l.row !== target.row);
  return [...shuffle(tier1, rng), ...shuffle(tier2, rng), ...shuffle(tier3, rng)];
}

/** Take options in order, skipping any whose label is already taken. */
function takeDistinct(candidates: Option[], taken: Set<string>, n: number): Option[] {
  const out: Option[] = [];
  for (const c of candidates) {
    if (out.length === n) break;
    if (taken.has(c.label)) continue;
    taken.add(c.label);
    out.push(c);
  }
  return out;
}

function letterOptions(item: Item, content: DrillContent, rng: Rng): Option[] {
  const target = content.letters.find((l) => l.char === item.shown);
  if (!target) return [];
  const taken = new Set([item.label]);
  return takeDistinct(
    letterCandidates(target, content, rng).map((l) => ({ label: l.label, shown: l.char })),
    taken,
    OPTION_COUNT - 1,
  );
}

/**
 * Two kinds of variation, at least one of each where possible:
 * A. the same consonant with a different unlocked mark, or no mark (inherent a);
 * B. a confusable consonant with the same mark.
 */
function syllableOptions(item: Item, content: DrillContent, rng: Rng): Option[] {
  const consonant = content.letters.find((l) => l.char === item.consonant);
  const mark = content.marks.find((m) => m.mark === item.mark);
  if (!consonant || !mark) return [];

  const sameConsonant: Option[] = shuffle(
    [
      { label: `${consonant.label}a`, shown: consonant.char },
      ...content.marks
        .filter((m) => m.unlocked && m.mark !== mark.mark)
        .map((m) => ({ label: consonant.label + m.label, shown: consonant.char + m.mark })),
    ],
    rng,
  );
  const otherConsonant: Option[] = letterCandidates(consonant, content, rng)
    .filter((l) => !VOWEL_CARRIERS.includes(l.char))
    .map((l) => ({ label: l.label + mark.label, shown: l.char + mark.mark }));

  const taken = new Set([item.label]);
  const picked = [
    ...takeDistinct(sameConsonant, taken, 1),
    ...takeDistinct(otherConsonant, taken, 1),
  ];

  // The rest: alternate between the two kinds, starting at random, so neither
  // kind dominates the remaining slots.
  const rest = rng() < 0.5 ? [otherConsonant, sameConsonant] : [sameConsonant, otherConsonant];
  let turn = 0;
  while (picked.length < OPTION_COUNT - 1) {
    const next =
      takeDistinct(rest[turn % 2], taken, 1)[0] ?? takeDistinct(rest[(turn + 1) % 2], taken, 1)[0];
    if (!next) break;
    picked.push(next);
    turn++;
  }
  return picked;
}

function wordOptions(item: Item, content: DrillContent): Option[] {
  const word = content.words.find((w) => ITEM_KIND.word(w.id) === item.id);
  if (!word) return [];
  return takeDistinct(
    word.options.map((label) => ({ label, shown: null })),
    new Set([item.label]),
    OPTION_COUNT - 1,
  );
}

/** The correct reading plus its distractors, in random order. */
export function optionsFor(item: Item, content: DrillContent, rng: Rng = Math.random): Option[] {
  const distractors =
    item.type === "letter"
      ? letterOptions(item, content, rng)
      : item.type === "syllable"
        ? syllableOptions(item, content, rng)
        : wordOptions(item, content);
  const correct: Option = { label: item.label, shown: item.type === "word" ? null : item.shown };
  return shuffle([correct, ...distractors], rng);
}

/**
 * The confusable sets a wrong pick shares with the target, by consonant.
 * Words have no letter-level pick, so they never name a set.
 */
export function confusionFor(item: Item, picked: Option, content: DrillContent): {
  sets: ConfusableSet[];
  shownConsonant: string;
  pickedConsonant: string;
} | null {
  if (item.type === "word" || !item.consonant || !picked.shown) return null;
  const pickedConsonant = splitSyllable(picked.shown, content).consonant;
  if (pickedConsonant === item.consonant) return null;
  const sets = sharedSets(item.consonant, pickedConsonant, content.sets);
  return sets.length ? { sets, shownConsonant: item.consonant, pickedConsonant } : null;
}

// --- Weighting -------------------------------------------------------------

/** Attempts per item, oldest first. */
export function historyByItem(attempts: Attempt[]): Map<string, Attempt[]> {
  const map = new Map<string, Attempt[]>();
  const sorted = [...attempts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const a of sorted) {
    const list = map.get(a.itemId) ?? [];
    list.push(a);
    map.set(a.itemId, list);
  }
  return map;
}

/** Items whose recent median recognition time is in the slowest quarter. */
export function slowItemIds(history: Map<string, Attempt[]>): Set<string> {
  const medians: { id: string; ms: number }[] = [];
  for (const [id, list] of history) {
    if (list.length < SLOW_MIN_ATTEMPTS) continue;
    const ms = median(list.slice(-RECENT_WINDOW).map((a) => a.recognitionMs));
    if (ms !== null) medians.push({ id, ms });
  }
  medians.sort((a, b) => b.ms - a.ms);
  const count = Math.ceil(medians.length * SLOW_QUANTILE);
  return new Set(medians.slice(0, count).map((m) => m.id));
}

export function weightOf(item: Item, history: Map<string, Attempt[]>, slow: Set<string>): number {
  const list = history.get(item.id) ?? [];
  const recentErrors = list.slice(-RECENT_WINDOW).filter((a) => !a.correct).length;
  const isSlow = slow.has(item.id) ? 1 : 0;
  const isNew = list.length < NEW_THRESHOLD ? 1 : 0;
  const rare = item.rare ? RARE_FACTOR : 1;
  return (1 + ERROR_WEIGHT * recentErrors + isSlow + isNew) * rare;
}

/**
 * The type of each slot in a session. Quotas come from the mix (largest
 * remainder, so they always sum to the session length); a type with no items
 * hands its share to the others. Order is shuffled.
 */
export function planSession(items: Item[], rng: Rng = Math.random): ItemType[] {
  const available = new Set(items.map((i) => i.type));
  const mix = available.has("word") ? MIX_WITH_WORDS : MIX_WITHOUT_WORDS;
  const types = (Object.keys(mix) as ItemType[]).filter((t) => available.has(t) && mix[t] > 0);
  if (types.length === 0) return [];

  const total = types.reduce((n, t) => n + mix[t], 0);
  const exact = types.map((t) => ({ t, v: (mix[t] / total) * SESSION_LENGTH }));
  const counts = new Map(exact.map((e) => [e.t, Math.floor(e.v)]));
  let left = SESSION_LENGTH - [...counts.values()].reduce((a, b) => a + b, 0);
  for (const e of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left-- <= 0) break;
    counts.set(e.t, counts.get(e.t)! + 1);
  }
  return shuffle(
    types.flatMap((t) => Array<ItemType>(counts.get(t)!).fill(t)),
    rng,
  );
}

/**
 * Weighted draw of the next item of `type`. History includes this session's
 * attempts, so an item missed a minute ago is already more likely. The item
 * just shown is never drawn again immediately.
 */
export function pickNext(
  items: Item[],
  type: ItemType,
  attempts: Attempt[],
  previousId: string | null,
  rng: Rng = Math.random,
): Item | null {
  let pool = items.filter((i) => i.type === type && i.id !== previousId);
  if (pool.length === 0) pool = items.filter((i) => i.id !== previousId);
  if (pool.length === 0) return null;

  const history = historyByItem(attempts);
  const slow = slowItemIds(history);
  const weights = pool.map((i) => weightOf(i, history, slow));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
