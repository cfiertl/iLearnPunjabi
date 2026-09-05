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

/**
 * How far `date` is offset from UTC in `timeZone`, in milliseconds.
 * Derived by asking Intl what wall-clock time that instant shows there.
 */
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

/** True if the string is an IANA zone this runtime understands. */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Midnight-aligned due date, `days` from the start of today — in the LEARNER's
 * timezone, not the server's.
 *
 * This matters more than it looks. Serverless functions run in UTC, so aligning
 * to the server's midnight put "due tomorrow" at 10am Sydney, which meant the
 * morning session systematically missed cards that should have been waiting.
 * Reviews are a daily habit anchored to the learner's day, so the day boundary
 * has to be theirs.
 */
export function dueInDays(
  days: number,
  now = new Date(),
  timeZone = "UTC",
): Date {
  const zone = isTimeZone(timeZone) ? timeZone : "UTC";

  // Today's calendar date as seen in the learner's zone.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);

  // That wall-clock midnight, `days` on, read as if it were UTC...
  const naive = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0, 0));

  // ...then shifted back by the zone's offset to get the real instant. The
  // offset has to be measured at the ANSWER, not at the guess: on the night
  // before a DST change the first guess lands the other side of the transition
  // and comes out an hour off, on the wrong day. Measuring again at the
  // candidate settles it.
  const firstPass = naive.getTime() - offsetMs(naive, zone);
  return new Date(naive.getTime() - offsetMs(new Date(firstPass), zone));
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
  timeZone = "UTC",
): Scheduled {
  if (grade === "correct") {
    const box = clampBox(currentBox + 1);
    return {
      box,
      dueAt: dueInDays(BOX_INTERVAL_DAYS[box - 1], now, timeZone),
      lapseDelta: 0,
      agreementDelta: 0,
    };
  }

  return {
    box: 1,
    dueAt: dueInDays(1, now, timeZone),
    lapseDelta: grade === "fail" ? 1 : 0,
    agreementDelta: grade === "agreement" ? 1 : 0,
  };
}
