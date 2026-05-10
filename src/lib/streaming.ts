// Accumulates streaming response deltas + tool-call status lines from a
// running agent turn and pushes them to a chat platform (Discord / Telegram)
// via debounced message edits. Smooth visible progress without hammering
// rate limits (Discord: ~5 edits / 5s per channel; Telegram: ~1 / s).
//
// Layout in the visible message:
//   <accumulated assistant text>
//
//   _<current tool-call status, if any>_
//
// On agent turn completion, call finalize() to flush a final edit with the
// status cleared.

import { errMsg, log } from '../log.js';

// 1500ms keeps us comfortably under Discord's ~5/5s per-channel edit cap
// even after the underlying transport adds its own retry-on-429 jitter.
const DEBOUNCE_MS = 1500;

export interface StreamAdapter {
  /** Send a fresh message; returns the new message id. */
  send(text: string): Promise<string>;
  /** Edit a previously-sent message. */
  edit(messageId: string, text: string): Promise<void>;
}

export class StreamingMessage {
  private text = '';
  private statusLine: string | null = null;
  private messageId: string | null = null;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private finalized = false;

  constructor(private adapter: StreamAdapter, private placeholder = '…') {}

  appendDelta(delta: string): void {
    if (this.finalized) return;
    this.text += delta;
    this.scheduleEdit();
  }

  setStatus(status: string | null): void {
    if (this.finalized) return;
    this.statusLine = status;
    this.scheduleEdit();
  }

  async finalize(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    if (this.pending) clearTimeout(this.pending);
    this.pending = null;
    this.statusLine = null;
    await this.flush();
  }

  private scheduleEdit(): void {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.flush();
    }, DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    const body = this.render();
    if (!body) return;
    try {
      if (!this.messageId) {
        this.messageId = await this.adapter.send(body);
      } else {
        await this.adapter.edit(this.messageId, body);
      }
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'streaming edit failed');
    }
  }

  private render(): string {
    const body = this.text || this.placeholder;
    return this.statusLine ? `${body}\n\n_${this.statusLine}_` : body;
  }
}
