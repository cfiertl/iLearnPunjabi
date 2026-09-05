// Leitner scheduling — five boxes, intervals 1/2/4/8/16 days.
//
// Deliberately NOT FSRS/SM-2: at this deck size Leitner is sufficient, and the
// diagnostic value lives in the review_events log, not in the interval maths.

export const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16] as const;
export const MAX_BOX = 5;

export type Box = 1 | 2 | 3 | 4 | 5;
export type Grade = "correct" | "agreement" | "fail";
export type ReviewMode = "production" | "cloze";

/**
 * The three grading buttons, in fixed display order.
 *
 * `agreement` is the whole point of this app: it records "right words, wrong
 * agreement". It schedules IDENTICALLY to `fail` on purpose — the two differ
 * only in what they record. Do not merge them.
 */
export const GRADES = [
  {
    grade: "correct",
    label: "Got it",
    key: "1",
    cls: "bg-success/15 text-success hover:bg-success/25",
  },
  {
    grade: "agreement",
    label: "Right words, wrong agreement",
    key: "2",
    cls: "bg-accent/15 text-accent hover:bg-accent/25",
  },
  {
    grade: "fail",
    label: "Couldn't produce it",
    key: "3",
    cls: "bg-danger/15 text-danger hover:bg-danger/25",
  },
] as const satisfies ReadonlyArray<{
  grade: Grade;
  label: string;
  key: string;
  cls: string;
}>;

export function isGrade(value: unknown): value is Grade {
  return value === "correct" || value === "agreement" || value === "fail";
}

export function isMode(value: unknown): value is ReviewMode {
  return value === "production" || value === "cloze";
}

function clampBox(n: number): Box {
  return Math.min(Math.max(Math.round(n), 1), MAX_BOX) as Box;
}

/** Midnight-aligned due date, `days` from the start of today. */
export function dueInDays(days: number, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export type Scheduled = {
  box: Box;
  dueAt: Date;
  lapseDelta: number;
  agreementDelta: number;
};

/**
 * Apply a grade to a card's current box.
 *
 * correct   -> box + 1 (max 5), due after that box's interval
 * agreement -> box 1, due tomorrow, agreementFails + 1
 * fail      -> box 1, due tomorrow, lapses + 1
 */
export function applyGrade(
  currentBox: number,
  grade: Grade,
  now = new Date(),
): Scheduled {
  if (grade === "correct") {
    const box = clampBox(currentBox + 1);
    return {
      box,
      dueAt: dueInDays(BOX_INTERVAL_DAYS[box - 1], now),
      lapseDelta: 0,
      agreementDelta: 0,
    };
  }

  return {
    box: 1,
    dueAt: dueInDays(1, now),
    lapseDelta: grade === "fail" ? 1 : 0,
    agreementDelta: grade === "agreement" ? 1 : 0,
  };
}
