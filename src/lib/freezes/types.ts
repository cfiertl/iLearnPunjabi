export type Bucket = "A" | "B" | "C";

/** Bucket meanings, as shown on the triage row. Order is fixed. */
export const BUCKETS = [
  {
    bucket: "A",
    label: "A — missing a word",
    hint: "Structure was known, vocabulary wasn't",
  },
  {
    bucket: "B",
    label: "B — missing a frame",
    hint: "Words known, no idea how to assemble them",
  },
  {
    bucket: "C",
    label: "C — knew it, froze",
    hint: "Needs drilling, not teaching",
  },
] as const satisfies ReadonlyArray<{
  bucket: Bucket;
  label: string;
  hint: string;
}>;

export function isBucket(value: unknown): value is Bucket {
  return value === "A" || value === "B" || value === "C";
}

/** What was done about a freeze. Separate from bucket, which is why it froze. */
export type Outcome = "carded" | "existing_card" | "parked" | "discarded";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  carded: "Carded",
  existing_card: "Covered by an existing card",
  parked: "Parked",
  discarded: "Discarded",
};

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && Object.hasOwn(OUTCOME_LABELS, value);
}

export type Freeze = {
  id: string;
  english: string;
  capturedAt: string;
  bucket: Bucket | null;
  /** Null until a session import triages it. */
  outcome: Outcome | null;
  /** The frame tag a parked freeze is waiting to be taught. */
  waitingOn: string | null;
  note: string | null;
  /** Derived from outcome in the database; never set directly. */
  resolved: boolean;
  /** Linked cards. Display-only; never affects scheduling. */
  cards: { id: string; englishPrompt: string }[];
};
