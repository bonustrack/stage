/** Streams agent deltas + tool calls to chat via debounced edits; splits past MAX_BODY_LEN. */

import { errMsg, log } from '../log.js';

/** 1500ms keeps us under Discord's ~5/5s per-channel edit cap; leading-edge 500ms for first delta. */
const DEFAULT_DEBOUNCE_MS = 1500;
const LEADING_MS = 500;
/** Discord cap is 2000; 1900 leaves headroom for status suffix. */
const MAX_BODY_LEN = 1900;
const STATUS_RESERVE = 80;

export interface StreamAdapter {
  send(text: string): Promise<string>;
  edit(messageId: string, text: string): Promise<void>;
}

/** One per bot. Coalesces edits so concurrent threads don't compound rate limits. */
export class StreamScheduler {
  private dirty = new Set<StreamingMessage>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushAt = 0;

  constructor(private debounceMs = DEFAULT_DEBOUNCE_MS, private leadingMs = LEADING_MS) {}

  request(stream: StreamingMessage): void {
    this.dirty.add(stream);
    if (this.timer) return;
    const sinceLast = Date.now() - this.lastFlushAt;
    const delay = sinceLast >= this.debounceMs ? this.leadingMs : this.debounceMs - sinceLast;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.lastFlushAt = Date.now();
      const batch = [...this.dirty];
      this.dirty.clear();
      for (const s of batch) void s._flushFromScheduler();
    }, delay);
  }

  forget(stream: StreamingMessage): void { this.dirty.delete(stream); }
}

/** Replace backticks in tool detail with U+02CB so they can't escape inline-code spans. */
const escapeBackticks = (s: string): string => s.replace(/`/g, 'ˋ');

type Segment = { id: string | null; text: string; dirty: boolean };
type LastBlock = 'empty' | 'text' | 'tool';

export class StreamingMessage {
  private segments: Segment[] = [{ id: null, text: '', dirty: false }];
  private statusLine: string | null = null;
  private flushing = false;
  private flushAgain = false;
  private finalized = false;
  private lastBlock: LastBlock = 'empty';

  constructor(private adapter: StreamAdapter, private scheduler: StreamScheduler) {}

  appendDelta(delta: string): void {
    if (this.finalized || !delta) return;
    if (this.lastBlock === 'tool') this.appendToLast('\n\n');
    this.appendToLast(delta);
    this.lastBlock = 'text';
    this.scheduler.request(this);
  }

  setStatus(status: string | null): void {
    if (this.finalized) return;
    this.statusLine = status;
    this.markLastDirty();
    this.scheduler.request(this);
  }

  /** Persist a tool call as `> 🛠 **<name>** \`<detail>\`` (Discord blockquote / Telegram <blockquote>). */
  appendToolCall(name: string, detail?: string): void {
    if (this.finalized) return;
    const lead = this.lastBlock === 'empty' ? '' : this.lastBlock === 'text' ? '\n\n' : '\n';
    const body = detail ? `**${name}** \`${escapeBackticks(detail)}\`` : `**${name}**`;
    this.appendToLast(`${lead}> 🛠 ${body}`);
    this.lastBlock = 'tool';
    this.scheduler.request(this);
  }

  /** Append `⚠️ <msg>` on its own line; preserves any prose/tools already streamed. */
  appendError(message: string): void {
    if (this.finalized) return;
    const sep = this.lastBlock === 'empty' ? '' : '\n\n';
    this.statusLine = null;
    this.appendToLast(`${sep}⚠️ ${message}`);
    this.lastBlock = 'text';
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

  async _flushFromScheduler(): Promise<void> { await this.flush(); }

  private appendToLast(delta: string): void {
    const cap = MAX_BODY_LEN - STATUS_RESERVE;
    let remaining = delta;
    while (remaining) {
      let last = this.segments[this.segments.length - 1];
      const room = cap - last.text.length;
      if (room <= 0) {
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

  /** Split at the last paragraph/line/sentence/word break in range; hard slice otherwise. */
  private sliceAtBoundary(s: string, room: number): string {
    if (s.length <= room) return s;
    const candidate = s.slice(0, room);
    for (const b of ['\n\n', '\n', '. ', ' ']) {
      const i = candidate.lastIndexOf(b);
      if (i > room * 0.5) return candidate.slice(0, i + b.length);
    }
    return candidate;
  }

  private markLastDirty(): void { this.segments[this.segments.length - 1].dirty = true; }

  private async flush(): Promise<void> {
    if (this.flushing) { this.flushAgain = true; return; }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          const body = this.render(s, i === this.segments.length - 1);
          if (!body) continue;
          try {
            if (s.id === null) { s.id = await this.adapter.send(body); s.dirty = false; }
            else if (s.dirty) { await this.adapter.edit(s.id, body); s.dirty = false; }
          } catch (err) { log.warn({ err: errMsg(err) }, 'streaming edit failed'); }
        }
      } while (this.flushAgain);
    } finally { this.flushing = false; }
  }

  private render(s: Segment, isLast: boolean): string {
    const body = s.text;
    const showStatus = isLast && !!this.statusLine;
    if (!body && !showStatus) return '';
    if (!body) return this.statusLine!;
    if (showStatus) return `${body}\n\n${this.statusLine}`;
    return body;
  }
}
