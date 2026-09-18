"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  buildItems,
  confusionFor,
  median,
  optionsFor,
  pickNext,
  planSession,
} from "@/lib/gurmukhi/drill";
import { enqueue, flush, localHistory, pendingAttempts, upload } from "@/lib/gurmukhi/local";
import {
  PALM_CHECK_LETTERS,
  type Attempt,
  type ConfusableSet,
  type DrillContent,
  type Item,
  type ItemType,
  type Option,
} from "@/lib/gurmukhi/types";

type Props = {
  content: DrillContent;
  serverHistory: Attempt[];
  palmHint: boolean;
};

type Stage = "say" | "pick" | "feedback" | "done";

type Current = {
  item: Item;
  options: Option[];
};

type Result = {
  attempt: Attempt;
  confusion: { sets: ConfusableSet[]; shownConsonant: string; pickedConsonant: string } | null;
};

/**
 * Show → Say → Pick → Feedback, twenty times.
 *
 * Options stay out of the DOM until "Said it", so recognition time measures
 * reading, not elimination. Each attempt is queued locally the moment it is
 * picked, so leaving mid-session or losing signal loses nothing.
 */
export function GurmukhiDrill(props: Props) {
  // Randomness, crypto and localStorage are browser-only, so the session is
  // never built during the server render — it would not match on hydration.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!isClient) return <div className="min-h-[20rem]" aria-busy="true" />;
  return <DrillSession {...props} />;
}

const noopSubscribe = () => () => {};

function DrillSession({ content, serverHistory, palmHint }: Props) {
  const items = useMemo(() => buildItems(content), [content]);

  // Built once per mount: a new session is a new visit.
  const [start] = useState(() => {
    const history = localHistory(serverHistory);
    const plan = planSession(items);
    const first = plan.length ? pickNext(items, plan[0], history, null) : null;
    return {
      sessionId: crypto.randomUUID(),
      history,
      plan,
      first: first ? { item: first, options: optionsFor(first, content) } : null,
      waiting: pendingAttempts().length,
    };
  });
  const { plan } = start;
  const history = useRef<Attempt[]>(start.history);

  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("say");
  const [current, setCurrent] = useState<Current | null>(start.first);
  const [session, setSession] = useState<Attempt[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [waiting, setWaiting] = useState(start.waiting);
  const [storageFailed, setStorageFailed] = useState(false);

  const shownAt = useRef(0);
  const optionsAt = useRef(0);
  const recognitionMs = useRef(0);

  const draw = useCallback(
    (type: ItemType, previousId: string | null) => {
      const item = pickNext(items, type, history.current, previousId);
      setCurrent(item ? { item, options: optionsFor(item, content) } : null);
      setStage("say");
    },
    [items, content],
  );

  // Anything left from an earlier offline session goes up now, and again
  // whenever the connection returns.
  useEffect(() => {
    const sync = () => void flush().then(setWaiting);
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  // Clocks start when the stage is committed to the screen, not when state
  // was set, so rendering cost is not charged to reading.
  useLayoutEffect(() => {
    if (stage === "say" && current) shownAt.current = performance.now();
    if (stage === "pick") optionsAt.current = performance.now();
  }, [stage, current]);

  const saidIt = useCallback(() => {
    recognitionMs.current = Math.round(performance.now() - shownAt.current);
    setStage("pick");
  }, []);

  const pick = useCallback(
    (option: Option) => {
      if (!current || stage !== "pick") return;
      const { item } = current;
      const correct = option.label === item.label;
      const attempt: Attempt = {
        attemptId: crypto.randomUUID(),
        sessionId: start.sessionId,
        timestamp: new Date().toISOString(),
        itemId: item.id,
        itemType: item.type,
        shown: item.shown,
        correctLabel: item.label,
        pickedLabel: option.label,
        pickedChar: item.type === "letter" ? option.shown : null,
        pickedShown: option.shown,
        correct,
        recognitionMs: recognitionMs.current,
        pickMs: Math.round(performance.now() - optionsAt.current),
      };

      if (!enqueue(attempt)) {
        // No local queue: send it straight up, which only works online.
        setStorageFailed(true);
        void upload([attempt]);
      }
      history.current = [attempt, ...history.current];
      setSession((s) => [...s, attempt]);
      setResult({ attempt, confusion: correct ? null : confusionFor(item, option, content) });
      setStage("feedback");
      void flush().then(setWaiting);
    },
    [current, stage, content, start.sessionId],
  );

  const next = useCallback(() => {
    const i = index + 1;
    if (i >= plan.length) {
      setStage("done");
      return;
    }
    setIndex(i);
    setResult(null);
    draw(plan[i], current?.item.id ?? null);
  }, [plan, index, current, draw]);

  // Feedback: tap anywhere, or press a key, to continue. Registered after the
  // pick's own click has finished dispatching, so that click cannot skip it.
  useEffect(() => {
    if (stage !== "feedback") return;
    const go = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest("[data-drill-exit]")) return;
      e.preventDefault();
      next();
    };
    const t = setTimeout(() => {
      window.addEventListener("click", go);
      window.addEventListener("keydown", go);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", go);
      window.removeEventListener("keydown", go);
    };
  }, [stage, next]);

  // Keyboard: Space/Enter for "Said it", 1-4 to pick.
  useEffect(() => {
    if (stage !== "say" && stage !== "pick") return;
    function onKey(e: KeyboardEvent) {
      if (stage === "say" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        saidIt();
      } else if (stage === "pick" && current) {
        const n = Number(e.key);
        if (n >= 1 && n <= current.options.length) {
          e.preventDefault();
          pick(current.options[n - 1]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, current, saidIt, pick]);

  if (items.length === 0 || plan.length === 0 || (!current && stage !== "done")) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-muted">
        Nothing unlocked to drill yet.
      </div>
    );
  }

  if (stage === "done") {
    return <EndScreen session={session} waiting={waiting} storageFailed={storageFailed} />;
  }

  const { item, options } = current!;
  const firstLetter = [...item.shown][0];
  const showPalm = palmHint && stage === "say" && PALM_CHECK_LETTERS.includes(firstLetter);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>
            {index + 1} / {plan.length}
          </span>
          <button
            data-drill-exit
            onClick={() => setStage("done")}
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            End session
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${Math.round((index / plan.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
        {/* Lang tag lets the browser pick Gurmukhi shaping; the string is
            always consonant then mark, and the font places ਿ on the left. */}
        <p lang="pa" className="font-gurmukhi text-7xl font-semibold leading-tight">
          {item.shown}
        </p>
        <p className={`h-4 text-xs text-muted ${showPalm ? "" : "invisible"}`}>Palm check</p>
      </div>

      {stage === "say" && (
        <button
          onClick={saidIt}
          className="rounded-xl bg-brand px-5 py-3.5 font-semibold text-brand-contrast transition hover:bg-brand-strong"
        >
          Said it
        </button>
      )}

      {stage === "pick" && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((o, i) => (
            <button
              key={`${o.label}-${i}`}
              onClick={() => pick(o)}
              className="rounded-xl border border-border bg-surface px-4 py-4 text-lg font-semibold transition hover:border-brand"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {stage === "feedback" && result && <Feedback result={result} />}
    </div>
  );
}

function Feedback({ result }: { result: Result }) {
  const { attempt, confusion } = result;
  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-4 py-4 text-center ${
        attempt.correct ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"
      }`}
    >
      <p className={`font-semibold ${attempt.correct ? "text-success" : "text-danger"}`}>
        {attempt.correct ? "Correct" : "Not quite"}
      </p>
      {!attempt.correct && (
        <>
          <p className="text-sm">
            It reads <strong>{attempt.correctLabel}</strong> — you picked{" "}
            <span className="text-muted">{attempt.pickedLabel}</span>
          </p>
          {confusion?.sets.map((s) => (
            <p key={s.id} className="text-sm text-muted">
              {s.description}:{" "}
              <span lang="pa" className="font-gurmukhi">
                {confusion.shownConsonant} vs {confusion.pickedConsonant}
              </span>
            </p>
          ))}
        </>
      )}
      <p className="mt-1 text-xs text-muted">Tap anywhere to continue</p>
    </div>
  );
}

function EndScreen({
  session,
  waiting,
  storageFailed,
}: {
  session: Attempt[];
  waiting: number;
  storageFailed: boolean;
}) {
  const correct = session.filter((a) => a.correct).length;
  const med = median(session.map((a) => a.recognitionMs));

  const counts = new Map<string, { shown: string; picked: string; n: number }>();
  for (const a of session) {
    if (a.correct) continue;
    const key = `${a.shown} ${a.pickedLabel}`;
    const c = counts.get(key) ?? { shown: a.shown, picked: a.pickedLabel, n: 0 };
    c.n++;
    counts.set(key, c);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-bold">Session complete</p>
      <dl className="grid w-full grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-xs text-muted">Correct</dt>
          <dd className="text-lg font-bold tabular-nums">
            {correct} / {session.length}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-xs text-muted">Median reading time</dt>
          <dd className="text-lg font-bold tabular-nums">
            {med === null ? "—" : `${(med / 1000).toFixed(1)}s`}
          </dd>
        </div>
      </dl>

      {top.length > 0 && (
        <div className="w-full text-left">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Top confusions
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {top.map((c) => (
              <li key={`${c.shown}-${c.picked}`} className="flex justify-between gap-3">
                <span>
                  <span lang="pa" className="font-gurmukhi text-lg">
                    {c.shown}
                  </span>{" "}
                  <span className="text-muted">read as</span> {c.picked}
                </span>
                <span className="tabular-nums text-muted">×{c.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {storageFailed ? (
        <p className="text-xs text-danger">
          This browser would not store attempts locally, so any made offline were not kept.
        </p>
      ) : (
        waiting > 0 && (
          <p className="text-xs text-muted">
            {waiting} attempt{waiting === 1 ? "" : "s"} saved on this device, uploading when
            you are back online.
          </p>
        )
      )}

      <Link
        href="/"
        className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-contrast hover:bg-brand-strong"
      >
        Back to home
      </Link>
    </div>
  );
}
