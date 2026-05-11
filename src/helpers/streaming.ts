/** Streams agent deltas + tool calls to chat via debounced edits; splits past MAX_BODY_LEN. */

import { errMsg, log } from '../log.js';

/** 1500ms keeps us under Discord's ~5/5s per-channel edit cap; leading-edge 500ms for first delta. */
const DEFAULT_DEBOUNCE_MS = 1500;
const LEADING_MS = 500;
/** Discord cap is 2000; 1900 leaves headroom for status suffix. */
const MAX_BODY_LEN = 1900;
const STATUS_RESERVE = 80;
/** Cap result so a 1000-line file dump doesn't blow the per-message char budget. */
const MAX_RESULT_LINES = 50;
const MAX_RESULT_CHARS = 1500;

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

/** Break embedded triple backticks so they can't close our fenced block early. */
const escapeFence = (s: string): string => s.replace(/```/g, '`​`​`');

/** Cap output by lines + chars; return `body` to embed and a `_(N more …)_` overflow note (or ''). */
function truncateResult(s: string): { body: string; overflow: string } {
  const lines = s.split('\n');
  let body = lines.slice(0, MAX_RESULT_LINES).join('\n');
  const droppedLines = Math.max(0, lines.length - MAX_RESULT_LINES);
  if (body.length > MAX_RESULT_CHARS) body = body.slice(0, MAX_RESULT_CHARS) + '…';
  if (droppedLines === 0 && body === s) return { body: s, overflow: '' };
  const noun = droppedLines > 0 ? `${droppedLines} more line${droppedLines === 1 ? '' : 's'}` : 'output truncated';
  return { body, overflow: `_(${noun})_` };
}

type TextBlock = { kind: 'text'; text: string };
type ToolBlock = { kind: 'tool'; id: string; name: string; detail?: string; result?: string };
type Block = TextBlock | ToolBlock;
type Segment = { id: string | null; text: string; dirty: boolean };

export class StreamingMessage {
  private blocks: Block[] = [];
  private segments: Segment[] = [{ id: null, text: '', dirty: false }];
  private statusLine: string | null = null;
  private flushing = false;
  private flushAgain = false;
  private finalized = false;

  constructor(private adapter: StreamAdapter, private scheduler: StreamScheduler) {}

  appendDelta(delta: string): void {
    if (this.finalized || !delta) return;
    const last = this.blocks.at(-1);
    if (last?.kind === 'text') last.text += delta;
    else this.blocks.push({ kind: 'text', text: delta });
    this.scheduler.request(this);
  }

  setStatus(status: string | null): void {
    if (this.finalized) return;
    this.statusLine = status;
    this.scheduler.request(this);
  }

  /** Add a tool block keyed by `id`; rendered immediately as a header, output filled in via appendToolResult. */
  appendToolCall(id: string, name: string, detail?: string): void {
    if (this.finalized) return;
    this.blocks.push({ kind: 'tool', id, name, detail });
    this.scheduler.request(this);
  }

  /** Set the matching tool block's result; renders truncated output under the header. */
  appendToolResult(id: string, result: string): void {
    if (this.finalized || !result) return;
    const tool = this.blocks.find((b): b is ToolBlock => b.kind === 'tool' && b.id === id);
    if (tool) tool.result = result;
    this.scheduler.request(this);
  }

  appendError(message: string): void {
    if (this.finalized) return;
    this.statusLine = null;
    this.blocks.push({ kind: 'text', text: `⚠️ ${message}` });
    this.scheduler.request(this);
  }

  async finalize(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    this.scheduler.forget(this);
    this.statusLine = null;
    await this.flush();
  }

  async _flushFromScheduler(): Promise<void> { await this.flush(); }

  /** Render the block list into a single markdown body. */
  private renderBody(): string {
    return this.blocks.map(b => b.kind === 'text' ? b.text : this.renderToolBlock(b)).join('\n\n').trim();
  }

  /** Plain header + fenced input block + fenced output block. Each fence is fully visible (no collapse). */
  private renderToolBlock(b: ToolBlock): string {
    const parts: string[] = [`🛠 **${b.name}**`];
    if (b.detail) parts.push('```\n' + escapeFence(b.detail) + '\n```');
    if (b.result) {
      const { body, overflow } = truncateResult(b.result);
      parts.push('```\n' + escapeFence(body) + '\n```');
      if (overflow) parts.push(overflow);
    }
    return parts.join('\n');
  }

  /** Redistribute the rendered body across segments, keeping existing segment ids stable. */
  private redistribute(): void {
    const fullBody = this.renderBody();
    const chunks = this.chunkify(fullBody, MAX_BODY_LEN - STATUS_RESERVE);
    if (!chunks.length) chunks.push('');
    for (let i = 0; i < chunks.length; i++) {
      if (i >= this.segments.length) {
        this.segments.push({ id: null, text: chunks[i], dirty: true });
      } else if (this.segments[i].text !== chunks[i]) {
        this.segments[i].text = chunks[i];
        this.segments[i].dirty = true;
      }
    }
  }

  private chunkify(s: string, cap: number): string[] {
    if (s.length <= cap) return [s];
    const out: string[] = [];
    for (let r = s; r.length > 0; ) {
      const take = r.length > cap ? this.sliceAtBoundary(r, cap) : r;
      out.push(take);
      r = r.slice(take.length);
    }
    return out;
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

  private async flush(): Promise<void> {
    if (this.flushing) { this.flushAgain = true; return; }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        this.redistribute();
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          const body = this.render(s, i === this.segments.length - 1);
          if (!body) continue;
          try {
            if (s.id === null) s.id = await this.adapter.send(body);
            else if (s.dirty) await this.adapter.edit(s.id, body);
            s.dirty = false;
          } catch (err) { log.warn({ err: errMsg(err) }, 'streaming edit failed'); }
        }
      } while (this.flushAgain);
    } finally { this.flushing = false; }
  }

  private render(s: Segment, isLast: boolean): string {
    const showStatus = isLast && !!this.statusLine;
    if (!s.text) return showStatus ? this.statusLine! : '';
    return showStatus ? `${s.text}\n\n${this.statusLine}` : s.text;
  }
}
