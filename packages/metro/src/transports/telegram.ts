/** Telegram transport: long-poll `getUpdates`. Emits raw Bot API updates. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { invoke } from '../invoke.js';
import type { Transport, EmitFn } from './index.js';

type RawUpdate = {
  update_id: number;
  message?: { date?: number };
  message_reaction?: { date?: number };
};

export class TelegramTransport implements Transport {
  readonly station = 'telegram';
  private pollOffset = 0;
  private pollAbort: AbortController | null = null;
  private offsetFile = join(STATE_DIR, 'telegram-offset.json');

  async start(emit: EmitFn): Promise<void> {
    await invoke('telegram', 'POST', '/deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    const persisted = Number(existsSync(this.offsetFile) ? readFileSync(this.offsetFile, 'utf8').trim() : 0) || 0;
    if (persisted > 0) this.pollOffset = persisted;
    else {
      /** First run: anchor on the latest update id (-1 returns the most recent without consuming). */
      const initial = await invoke('telegram', 'POST', '/getUpdates', { offset: -1, timeout: 0 }) as RawUpdate[];
      this.pollOffset = initial.length ? initial[0].update_id + 1 : 0;
      this.saveOffset();
    }
    log.info({ offset: this.pollOffset }, 'telegram transport: polling started');
    this.pollAbort = new AbortController();
    void this.pollLoop(emit);
  }

  async stop(): Promise<void> { this.pollAbort?.abort(); this.pollAbort = null; }

  async getMe(): Promise<{ id: number; username: string } | null> {
    try { return await invoke('telegram', 'POST', '/getMe', {}) as { id: number; username: string }; }
    catch (err) { log.debug({ err: errMsg(err) }, 'telegram: getMe failed'); return null; }
  }

  private saveOffset(): void {
    try { writeFileSync(this.offsetFile, String(this.pollOffset)); }
    catch (err) { log.warn({ err: errMsg(err) }, 'telegram offset save failed'); }
  }

  private async pollLoop(emit: EmitFn): Promise<void> {
    const body = { timeout: 25, allowed_updates: ['message', 'message_reaction'] };
    while (this.pollAbort && !this.pollAbort.signal.aborted) {
      try {
        const updates = await invoke('telegram', 'POST', '/getUpdates',
          { offset: this.pollOffset, ...body }, 60_000) as RawUpdate[];
        for (const u of updates) {
          this.pollOffset = u.update_id + 1;
          this.dispatch(u, emit);
        }
        if (updates.length) this.saveOffset();
      } catch (err) {
        if (this.pollAbort?.signal.aborted) break;
        log.warn({ err: errMsg(err) }, 'telegram poll error; backing off');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  private dispatch(u: RawUpdate, emit: EmitFn): void {
    if (u.message) emit({
      station: 'telegram', kind: 'message',
      ts: new Date((u.message.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      payload: u.message,
    });
    if (u.message_reaction) emit({
      station: 'telegram', kind: 'reaction',
      ts: new Date((u.message_reaction.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      payload: u.message_reaction,
    });
  }
}
