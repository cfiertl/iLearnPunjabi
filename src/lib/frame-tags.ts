// Frame tag reference — the single source of truth for agreement rules.
//
// Two forms per tag: `short` for card backs, where the reader is mid-recall and
// space is tight, and `long` with a worked example for the reference section.
// Keeping both here means they cannot drift apart.
//
// Unknown tags are allowed everywhere: import warns about them rather than
// rejecting, so the deck can grow structures this table has not caught up with.

export type FrameEntry = {
  short: string;
  long: string;
};

export const FRAME_TAGS: Record<string, FrameEntry> = {
  dative_subject: {
    short: "Experiencer takes -nu; verb agrees with the experience, not you",
    long: "Experiencer takes -nu. The verb agrees with the experience, not with you. Mainu bhukh laggi hai — never haan.",
  },
  copula_agreement: {
    short: "haan / hai / ho / han — follows the grammatical subject",
    long: "Four forms: haan (main/asi), hai (3rd sg), ho (tusi), han (3rd pl). Follows the grammatical subject, which is often not the English one.",
  },
  genitive_da_di_de: {
    short: "Agrees with the thing possessed, not the possessor",
    long: "Agrees with the thing possessed, not the possessor. Mere bhra di kaar — di, because the car is feminine.",
  },
  perfective_object_agr: {
    short: "Past transitive verb agrees with the object",
    long: "Past transitive verb agrees with the object. Main roti khadhi — khadhi, because roti is feminine.",
  },
  future_anga_angi: {
    short: "-anga (m) / -angi (f) on the stem",
    long: "-anga (m) / -angi (f) on the stem. Main karanga.",
  },
  polite_imperative: {
    short: "tusi form, + ji for elders",
    long: "tusi form, plus ji for elders. Baith jao ji, never baith.",
  },
  negation_placement: {
    short: "nahi goes before the verb; commands use na",
    long: "nahi goes immediately before the verb. Commands use na, not nahi.",
  },
  continuous_agreement: {
    short: "riha/rahi/rahe matches subject gender and number",
    long: "riha / rahi / rahe matches subject gender and number. tusi always forces rahe + ho.",
  },
};

export const KNOWN_FRAME_TAGS = Object.keys(FRAME_TAGS);

/** Short rule for card backs, or null when the tag is not in the table. */
export function frameRule(tag: string): string | null {
  return FRAME_TAGS[tag]?.short ?? null;
}

/** Fuller rule with an example, for the reference section. */
export function frameLongRule(tag: string): string | null {
  return FRAME_TAGS[tag]?.long ?? null;
}

/** "perfective_object_agr" -> "Perfective object agr" for table headings. */
export function frameLabel(tag: string): string {
  const s = tag.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
