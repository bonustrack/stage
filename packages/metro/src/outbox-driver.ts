/** Daemon-side outbox driver: wraps the supervisor's forward-call so MUTATE calls
 *  are journaled, retried with backoff, and dead-lettered. READ calls + unknown
 *  verbs pass straight through (byte-identical). See outbox.ts for rationale. */

import { errMsg, log } from './log.js';
import { mutateVerbs, type VerbOwner } from './registry.js';
import { Outbox, type ErrorInfo, type OutboxEntry } from './outbox.js';
import type { TrainCallResponse } from './trains/protocol.js';

/** Minimal slice of the supervisor the driver needs (keeps it unit-testable). */
export type CallFn = (train: string, action: string, args: unknown) => Promise<TrainCallResponse>;

const VERB_OWNERS: readonly VerbOwner[] = ['xmtp', 'discord', 'telegram', 'core'];
const isOwner = (t: string): t is VerbOwner => (VERB_OWNERS as readonly string[]).includes(t);

/** Is `train`/`action` a MUTATE verb per the registry? Unknown trains/actions are
 *  treated as non-mutate (pass-through) so the journal never grows on calls the
 *  registry doesn't model — conservative + additive. */
export function isMutateCall(train: string, action: string): boolean {
  if (!isOwner(train)) return false;
  return mutateVerbs(train).has(action);
}

/** Pull a structured-error hint off a train response if the train emitted one
 *  (sibling PR #472 adds `errorInfo`). Absent ⇒ undefined ⇒ string-based class. */
function errorInfoOf(resp: TrainCallResponse): ErrorInfo | undefined {
  const info = (resp as { errorInfo?: unknown }).errorInfo;
  return info && typeof info === 'object' ? (info as ErrorInfo) : undefined;
}

export class OutboxDriver {
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly call: CallFn, private readonly outbox = new Outbox()) {}

  /** Forward a call, journaling + retrying it when it is a MUTATE verb. Returns
   *  the train's response (or throws) exactly as a bare forward-call would, so the
   *  CLI's immediate result is unchanged; retries continue in the background. */
  async forward(
    train: string, action: string, args: unknown, idempotencyKey?: string,
  ): Promise<TrainCallResponse> {
    if (!isMutateCall(train, action)) return this.call(train, action, args);
    const key = idempotencyKey ?? `idem_${train}_${action}_${Date.now()}`;
    const entry = this.outbox.enqueue(key, train, action, args);
    return this.attempt(entry);
  }

  /** One dispatch attempt. On success → sent. On failure → failed (schedules a
   *  retry) or dead. Re-throws the error so the synchronous caller still sees it. */
  private async attempt(entry: OutboxEntry): Promise<TrainCallResponse> {
    this.outbox.markAttempt(entry.outboxId);
    try {
      const resp = await this.call(entry.train, entry.action, entry.args);
      if (resp.error) {
        this.onFailure(entry, resp.error, errorInfoOf(resp));
        return resp;
      }
      this.outbox.markSent(entry.outboxId);
      return resp;
    } catch (err) {
      this.onFailure(entry, errMsg(err), undefined);
      throw err;
    }
  }

  /** Classify a failure + schedule the next attempt (or dead-letter). */
  private onFailure(entry: OutboxEntry, error: string, info?: ErrorInfo): void {
    const backoff = this.outbox.markFailed(entry.outboxId, error, info);
    if (backoff === null) {
      log.warn({ outboxId: entry.outboxId, train: entry.train, action: entry.action, error },
        'outbox: dead letter (no more retries) — see `metro outbox --state dead`');
      return;
    }
    log.info({ outboxId: entry.outboxId, train: entry.train, action: entry.action, backoff, error },
      'outbox: retry scheduled');
    this.scheduleRetry(entry, backoff);
  }

  private scheduleRetry(entry: OutboxEntry, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.attempt(entry).catch(() => { /* failure already journaled */ });
    }, delay);
    this.timers.add(timer);
  }

  /** Restart recovery: re-dispatch entries that were never put on the wire.
   *  CONSERVATIVE — only attempts===0 pending entries, so a replay can never
   *  duplicate a message on a train without dedup. See outbox.ts header. */
  recover(): void {
    const replay = this.outbox.pendingForReplay();
    if (!replay.length) return;
    log.info({ count: replay.length }, 'outbox: replaying never-dispatched entries after restart');
    for (const e of replay) void this.attempt(e).catch(() => { /* journaled */ });
  }

  /** Manual requeue of a dead/failed entry (CLI `metro outbox retry <id>`). */
  retry(outboxId: string): boolean {
    const e = this.outbox.requeue(outboxId);
    if (!e) return false;
    void this.attempt(e).catch(() => { /* journaled */ });
    return true;
  }

  list(opts: Parameters<Outbox['list']>[0] = {}): OutboxEntry[] { return this.outbox.list(opts); }

  /** Cancel all pending retry timers (daemon shutdown). */
  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
