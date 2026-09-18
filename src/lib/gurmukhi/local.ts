import { createClient } from "@/lib/supabase/client";
import { toAttemptRow } from "./rows";
import type { Attempt } from "./types";

// Browser-side persistence for the drill, so a whole session works offline.
//
// Every attempt is written to a local queue the moment it is picked, then
// uploaded when there is a connection. The attempt id is generated here, so an
// upload that succeeded but whose response was lost lands once on retry.
//
// Recently uploaded attempts are also kept locally: the page may be served
// from the service-worker cache with history as of its last online render, and
// weighting should still see what was drilled since.

const PENDING_KEY = "ilp:gurmukhi:pending";
const HISTORY_KEY = "ilp:gurmukhi:history";
const LOCAL_HISTORY_CAP = 1500;

function read(key: string): Attempt[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, attempts: Attempt[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(attempts));
    return true;
  } catch {
    return false;
  }
}

export function pendingAttempts(): Attempt[] {
  return read(PENDING_KEY);
}

/** Newest first, deduplicated by id, capped. */
export function mergeHistory(...lists: Attempt[][]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const list of lists) for (const a of list) byId.set(a.attemptId, a);
  return [...byId.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, LOCAL_HISTORY_CAP);
}

/** Server history plus anything this browser knows that the render did not. */
export function localHistory(serverHistory: Attempt[]): Attempt[] {
  return mergeHistory(serverHistory, read(HISTORY_KEY), read(PENDING_KEY));
}

/** Queue an attempt. False only if the browser refused to store it. */
export function enqueue(attempt: Attempt): boolean {
  return write(PENDING_KEY, [...read(PENDING_KEY), attempt]);
}

/** Insert attempts; an id already stored is skipped, so retries are harmless. */
export async function upload(batch: Attempt[]): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from("gurmukhi_attempts")
      .upsert(batch.map(toAttemptRow), { onConflict: "id", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

let flushing: Promise<number> | null = null;

/**
 * Upload everything queued. Resolves to the number still waiting. Safe to call
 * at any time and as often as liked: concurrent calls share one upload.
 */
export function flush(): Promise<number> {
  flushing ??= (async () => {
    // Yield first: without it an empty queue finishes synchronously, `finally`
    // clears `flushing` before the assignment above, and the settled promise
    // would then be handed to every later call.
    await Promise.resolve();
    try {
      const batch = read(PENDING_KEY);
      if (batch.length === 0) return 0;
      if (typeof navigator !== "undefined" && !navigator.onLine) return batch.length;

      if (!(await upload(batch))) return read(PENDING_KEY).length;

      // Re-read: an attempt may have been queued while the upload ran.
      const sent = new Set(batch.map((a) => a.attemptId));
      const remaining = read(PENDING_KEY).filter((a) => !sent.has(a.attemptId));
      write(HISTORY_KEY, mergeHistory(read(HISTORY_KEY), batch));
      write(PENDING_KEY, remaining);
      return remaining.length;
    } catch {
      return read(PENDING_KEY).length;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
