// Accumulates streaming response deltas + tool-call status lines from a
// running agent turn and pushes them to a chat platform (Discord / Telegram)
// via debounced message edits. Smooth visible progress without hammering
// rate limits.
//
// The debounce is owned by a per-bot `StreamScheduler`, not by individual
// streams. One tick (e.g. every 1500ms) flushes every dirty stream the bot
// has accumulated, so two concurrent threads don't compound into 2× the
// edit rate on the same bot token.
//
// When the agent's response grows past the platform's per-message content
// cap, the body is split across multiple messages: the prior segment is
// frozen at its final text, and a fresh message holds the continuation
// (with the live status line, which always anchors to the latest segment).
//
// On agent turn completion, call finalize() to flush a final edit with the
// status cleared.

import { errMsg, log } from '../log.js';

// Steady-state cadence: 1500ms keeps us comfortably under Discord's ~5/5s
// per-channel edit cap even after the transport adds its own retry-on-429
// jitter. After a quiet period, the next flush is leading-edge (LEADING_MS)
// so short responses don't appear as one final dump.
const DEFAULT_DEBOUNCE_MS = 1500;
const LEADING_MS = 500;

// Discord's bot content cap is 2000 by default (4000 for boosted/Nitro).
// 1900 is universally safe and leaves headroom for the status suffix.
const MAX_BODY_LEN = 1900;
// Reserve for "\n\n_<status>_" + a continuation hint.
const STATUS_RESERVE = 80;

export interface StreamAdapter {
  /** Send a fresh message; returns the new message id. */
  send(text: string): Promise<string>;
  /** Edit a previously-sent message. */
  edit(messageId: string, text: string): Promise<void>;
}

/**
 * One scheduler per bot. Coalesces edits across every active stream the
 * bot is serving — Discord's per-channel rate limit doesn't compound when
 * we run multiple threads concurrently this way.
 */
export class StreamScheduler {
  private dirty = new Set<StreamingMessage>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushAt = 0;

  constructor(
    private debounceMs = DEFAULT_DEBOUNCE_MS,
    private leadingMs = LEADING_MS,
  ) {}

  request(stream: StreamingMessage): void {
    this.dirty.add(stream);
    if (this.timer) return;
    // Leading-edge: if we haven't flushed recently, fire fast so the first
    // visible content lands within `leadingMs` of the agent's first delta.
    // Otherwise stay at the steady-state cadence to respect rate limits.
    const sinceLast = Date.now() - this.lastFlushAt;
    const delay = sinceLast >= this.debounceMs ? this.leadingMs : this.debounceMs - sinceLast;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.lastFlushAt = Date.now();
      const batch = [...this.dirty];
      this.dirty.clear();
      // Fire all in parallel — distinct channels are in distinct rate-limit
      // buckets, so they don't queue behind each other.
      for (const s of batch) void s._flushFromScheduler();
    }, delay);
  }

  /** Drop a stream from the queue (called when it finalizes). */
  forget(stream: StreamingMessage): void {
    this.dirty.delete(stream);
  }
}

type Segment = {
  id: string | null;
  text: string;
  /** Pending changes that haven't been flushed yet. */
  dirty: boolean;
};

export class StreamingMessage {
  private segments: Segment[] = [{ id: null, text: '', dirty: false }];
  private statusLine: string | null = null;
  private flushing = false;
  private flushAgain = false;
  private finalized = false;

  constructor(
    private adapter: StreamAdapter,
    private scheduler: StreamScheduler,
  ) {}

  appendDelta(delta: string): void {
    if (this.finalized || !delta) return;
    this.appendToLast(delta);
    this.scheduler.request(this);
  }

  setStatus(status: string | null): void {
    if (this.finalized) return;
    this.statusLine = status;
    this.markLastDirty();
    this.scheduler.request(this);
  }

  /**
   * Append an error notice to the visible message. Renders as `⚠️ <msg>`
   * either on its own (no prior text) or after a blank line (preserves
   * whatever streamed before the failure). Clears any pending status
   * line since 'Thinking…' is meaningless after an error.
   */
  appendError(message: string): void {
    if (this.finalized) return;
    const last = this.segments[this.segments.length - 1];
    const sep = last.text ? '\n\n' : '';
    this.statusLine = null;
    this.appendToLast(`${sep}⚠️ ${message}`);
    this.scheduler.request(this);
  }

  async finalize(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    this.scheduler.forget(this);
    this.statusLine = null;
    this.markLastDirty();
    await this.flush();
  }

  /** Internal — called by the scheduler tick. */
  async _flushFromScheduler(): Promise<void> {
    await this.flush();
  }

  private appendToLast(delta: string): void {
    const cap = MAX_BODY_LEN - STATUS_RESERVE;
    let remaining = delta;
    while (remaining) {
      let last = this.segments[this.segments.length - 1];
      const room = cap - last.text.length;
      if (room <= 0) {
        // Previous last loses status anchor — re-edit without it.
        last.dirty = true;
        last = { id: null, text: '', dirty: false };
        this.segments.push(last);
        continue;
      }
      const take = this.sliceAtBoundary(remaining, room);
      last.text += take;
      last.dirty = true;
      remaining = remaining.slice(take.length);
    }
  }

  // Prefer splitting at the last newline / space / sentence end within the
  // allowed slice, so continuation messages don't cut words in half. Falls
  // back to a hard slice if no boundary is in reach.
  private sliceAtBoundary(s: string, room: number): string {
    if (s.length <= room) return s;
    const candidate = s.slice(0, room);
    const breakers = ['\n\n', '\n', '. ', ' '];
    for (const b of breakers) {
      const i = candidate.lastIndexOf(b);
      if (i > room * 0.5) return candidate.slice(0, i + b.length);
    }
    return candidate;
  }

  private markLastDirty(): void {
    this.segments[this.segments.length - 1].dirty = true;
  }

  private async flush(): Promise<void> {
    if (this.flushing) { this.flushAgain = true; return; }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          const isLast = i === this.segments.length - 1;
          const body = this.render(s, isLast);
          if (!body) continue;
          try {
            if (s.id === null) {
              s.id = await this.adapter.send(body);
              s.dirty = false;
            } else if (s.dirty) {
              await this.adapter.edit(s.id, body);
              s.dirty = false;
            }
          } catch (err) {
            log.warn({ err: errMsg(err) }, 'streaming edit failed');
            // Leave dirty=true so the next tick retries.
          }
        }
      } while (this.flushAgain);
    } finally {
      this.flushing = false;
    }
  }

  private render(s: Segment, isLast: boolean): string {
    const body = s.text;
    const showStatus = isLast && !!this.statusLine;
    if (!body && !showStatus) return ''; // nothing to show yet — skip the flush
    if (!body) return this.statusLine!;
    if (showStatus) return `${body}\n\n${this.statusLine}`;
    return body;
  }
}
