/** Durable outbox journal for outbound MUTATE calls. Every MUTATE forward-call
 *  (classified via registry kind:'mutate') is journaled to outbox.jsonl BEFORE the
 *  train responds, then transitioned on the outcome. */

// State machine:
//   pending → sent   on a successful op:response
//   pending → failed on a retryable failure, then retried w/ backoff to the cap
//   pending → dead   on a terminal failure (errorInfo.retryable===false / a
//                    non-retryable error string) or once the attempt cap is hit.

// The journal makes drops VISIBLE (`metro outbox --state dead`) and lets the
// daemon retry transient failures + a dead letter be requeued by hand.

// ADDITIVE + idle-safe: the file is created lazily on the first MUTATE dispatch.
// With the file absent and no MUTATE traffic this module never touches disk and
// the dispatch path is byte-identical to the pre-outbox behavior; READ calls and
// daemon-level (non-train) ops are never journaled.

// Idempotency: each logical send carries an `idempotencyKey` (minted CLI-side,
// threaded through the forward-call envelope). The key in the journal alone stops
// the DAEMON double-dispatching on restart-replay; trains may also dedup on it.
// We never mutate train internals beyond carrying the key in the envelope.

// Restart-replay conservatism (IMPORTANT): on boot pendingForReplay() returns
// ONLY entries never put on the wire (attempts===0). The dangerous case is an
// entry whose train already received it and whose op:response was lost across the
// restart — re-sending would double-post on a train without dedup (XMTP has none).
// Replaying only attempts===0 guarantees the message never reached the wire, so a
// replay cannot duplicate. Dispatched-but-unresolved entries stay `pending` and
// are shown by `metro outbox` for a deliberate `metro outbox retry <id>` (opt-in).

import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';

export const OUTBOX_FILE = join(STATE_DIR, 'outbox.jsonl');

/** Backoff schedule (ms) indexed by the attempt that just failed (0-based). The
 *  length also caps total attempts: a failure on the last index → dead. */
export const RETRY_BACKOFFS_MS = [2_000, 10_000, 30_000] as const;
/** Total dispatch attempts before a retryable failure becomes a dead letter. */
export const MAX_ATTEMPTS = RETRY_BACKOFFS_MS.length;

export type OutboxState = 'pending' | 'sent' | 'failed' | 'dead';

/** Optional structured-error hint carried on a train response (sibling PR #472).
 *  Treated as a loose shape: only `retryable` is consulted, and only if present. */
export type ErrorInfo = { retryable?: boolean } & Record<string, unknown>;

export type OutboxEntry = {
  outboxId: string;
  idempotencyKey: string;
  train: string;
  action: string;
  args: unknown;
  state: OutboxState;
  attempts: number;
  ts: string;
  updatedAt?: string;
  lastError?: string;
};

/** Mint a globally-unique idempotency key for one logical send. */
export const mintIdempotencyKey = (): string => `idem_${randomUUID()}`;

/** Decide whether a failed dispatch should be retried, given attempts so far and
 *  the error classification. Terminal when: errorInfo.retryable===false, the
 *  error string looks non-retryable, or the attempt cap is reached. */
export function isRetryable(error: string | undefined, info: ErrorInfo | undefined): boolean {
  if (info && info.retryable === false) return false;
  if (info && info.retryable === true) return true;
  // No structured hint: classify the error string. Validation / unsupported /
  // not-found / auth failures are terminal; everything else (timeout, transient
  // platform/network errors) is retryable.
  const e = (error ?? '').toLowerCase();
  if (!e) return true;
  return !/invalid|unsupported|not found|no such|unauthor|forbidden|bad request|malformed|rejected/.test(e);
}

/** The journal: an in-memory index backed by an append-only JSONL file. Compacts
 *  on load (terminal entries past a cap are dropped) and on explicit compaction. */
export class Outbox {
  private entries = new Map<string, OutboxEntry>();
  private loaded = false;

  constructor(private readonly file: string = OUTBOX_FILE) {}

  /** Lazily read the JSONL file into the index. Tolerant of partial/corrupt lines
   *  (logs + skips) so a truncated tail can never wedge daemon boot. */
  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.file)) return;
    let raw: string;
    try { raw = readFileSync(this.file, 'utf8'); }
    catch (err) { log.warn({ err: errMsg(err), file: this.file }, 'outbox: read failed; starting empty'); return; }
    for (const line of raw.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      try {
        const e = JSON.parse(s) as OutboxEntry;
        if (e && typeof e.outboxId === 'string') this.entries.set(e.outboxId, e);
      } catch (err) {
        log.warn({ err: errMsg(err), line: s.slice(0, 120) }, 'outbox: bad JSONL line; skipped');
      }
    }
  }

  /** Append a JSONL line for the current state of `e` (last-line-wins on reload). */
  private append(e: OutboxEntry): void {
    try { appendFileSync(this.file, JSON.stringify(e) + '\n'); }
    catch (err) { log.warn({ err: errMsg(err), file: this.file }, 'outbox: append failed (entry not durable)'); }
  }

  /** Record a brand-new pending entry for a MUTATE dispatch and persist it. */
  enqueue(idempotencyKey: string, train: string, action: string, args: unknown): OutboxEntry {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const e: OutboxEntry = {
      outboxId: `out_${randomUUID()}`, idempotencyKey, train, action, args,
      state: 'pending', attempts: 0, ts: now,
    };
    this.entries.set(e.outboxId, e);
    this.append(e);
    return e;
  }

  /** Mark an attempt about to be made (increments the counter, stays pending). */
  markAttempt(outboxId: string): void {
    const e = this.entries.get(outboxId);
    if (!e) return;
    e.attempts += 1;
    e.updatedAt = new Date().toISOString();
    this.append(e);
  }

  /** Transition to `sent` after a successful response. */
  markSent(outboxId: string): void { this.transition(outboxId, 'sent'); }

  /** Transition after a failed attempt: `failed` if retries remain, else `dead`.
   *  Returns the backoff (ms) to wait before the next attempt, or null if dead. */
  markFailed(outboxId: string, error: string | undefined, info?: ErrorInfo): number | null {
    const e = this.entries.get(outboxId);
    if (!e) return null;
    e.lastError = error ?? 'unknown error';
    const retryable = isRetryable(error, info);
    if (!retryable || e.attempts >= MAX_ATTEMPTS) {
      this.transition(outboxId, 'dead');
      return null;
    }
    this.transition(outboxId, 'failed');
    const idx = Math.min(e.attempts - 1, RETRY_BACKOFFS_MS.length - 1);
    return RETRY_BACKOFFS_MS[Math.max(0, idx)];
  }

  /** Force a dead/failed entry back to pending for a manual requeue. Returns the
   *  reset entry, or null if unknown. Resets attempts so the backoff starts fresh. */
  requeue(outboxId: string): OutboxEntry | null {
    this.ensureLoaded();
    const e = this.entries.get(outboxId);
    if (!e) return null;
    e.state = 'pending';
    e.attempts = 0;
    e.lastError = undefined;
    e.updatedAt = new Date().toISOString();
    this.append(e);
    return e;
  }

  private transition(outboxId: string, state: OutboxState): void {
    const e = this.entries.get(outboxId);
    if (!e) return;
    e.state = state;
    e.updatedAt = new Date().toISOString();
    this.append(e);
  }

  get(outboxId: string): OutboxEntry | undefined { this.ensureLoaded(); return this.entries.get(outboxId); }

  /** All entries (newest first), optionally filtered by state, capped by limit. */
  list(opts: { state?: OutboxState; limit?: number } = {}): OutboxEntry[] {
    this.ensureLoaded();
    let out = [...this.entries.values()];
    if (opts.state) out = out.filter(e => e.state === opts.state);
    out.sort((a, b) => (b.ts).localeCompare(a.ts));
    if (opts.limit && opts.limit > 0) out = out.slice(0, opts.limit);
    return out;
  }

  /** Entries safe to auto-replay on daemon boot: CONSERVATIVELY only those that
   *  were never put on the wire (attempts === 0). See the file header for why an
   *  entry that was dispatched but unresolved is NOT auto-replayed. */
  pendingForReplay(): OutboxEntry[] {
    this.ensureLoaded();
    return [...this.entries.values()].filter(e => e.state === 'pending' && e.attempts === 0);
  }

  /** Rewrite the file from the in-memory index (drops superseded JSONL lines).
   *  Atomic via temp-file rename. Best-effort: a failure leaves the append log. */
  compact(): void {
    this.ensureLoaded();
    const tmp = `${this.file}.tmp`;
    try {
      const body = [...this.entries.values()].map(e => JSON.stringify(e)).join('\n');
      writeFileSync(tmp, body ? body + '\n' : '');
      renameSync(tmp, this.file);
    } catch (err) { log.warn({ err: errMsg(err), file: this.file }, 'outbox: compaction failed'); }
  }
}
