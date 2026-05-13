/** Telegram station: long-poll bot API; sends agent-style markdown as HTML with plain-text fallback. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { mintId } from '../history.js';
import { mdToTelegramHtml } from './telegram-md.js';
import { inlineKeyboard, tgSendRich } from './telegram-upload.js';
import {
  Line, type Capabilities, type ChatStation, type EditOpts,
  type InboundMessage, type Line as LineT, type SendOpts,
} from './index.js';
import { STATE_DIR } from '../paths.js';

const API_BASE = 'https://api.telegram.org';
const NO_PREVIEW = { link_preview_options: { is_disabled: true } };
const MAX_BYTES = 20 * 1024 * 1024;

const token = (): string => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
};

async function tg<T = unknown>(
  method: string, body: unknown, opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const signals: AbortSignal[] = [AbortSignal.timeout(opts.timeoutMs ?? 30_000)];
  if (opts.signal) signals.push(opts.signal);
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.any(signals),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

export type TelegramMeta = { isPrivate: boolean; inForum: boolean; isForumTopic: boolean };

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type Photo = { file_id: string };
type Doc = { file_id: string; mime_type?: string; file_name?: string };
type RawMessage = {
  message_id: number; date?: number;
  chat?: { id: number; type?: string; is_forum?: boolean; title?: string; first_name?: string };
  message_thread_id?: number; is_topic_message?: boolean;
  text?: string; caption?: string; entities?: Entity[]; caption_entities?: Entity[];
  photo?: Photo[]; document?: Doc; voice?: Doc; audio?: Doc;
  from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string };
};
type RawUpdate = { update_id: number; message?: RawMessage };

const isParseError = (err: unknown): boolean => errMsg(err).includes("can't parse entities");
const isNoopEdit = (err: unknown): boolean => errMsg(err).includes('message is not modified');

const targetOf = (line: LineT): { chatId: number; topicId?: number } => {
  const t = Line.parseTelegram(line);
  if (!t) throw new Error(`not a telegram line: ${line}`);
  return t;
};

function attachmentTags(m: RawMessage): string[] {
  const out: string[] = [];
  if (m.photo?.length) out.push('[image]');
  if (m.document?.mime_type?.startsWith('image/')) out.push('[image]');
  else if (m.document) out.push(`[file: ${m.document.file_name ?? m.document.file_id}]`);
  if (m.voice) out.push('[voice]');
  if (m.audio) out.push('[audio]');
  return out;
}

const CAPS: Capabilities = {
  in: ['text', 'image'], out: ['text'],
  features: ['reply', 'send', 'edit', 'react', 'download', 'fetch'],
};

export class TelegramStation implements ChatStation<TelegramMeta> {
  readonly name = 'telegram';
  readonly capabilities = CAPS;

  private botUsername: string | null = null;
  private botUserId: number | null = null;
  private pollOffset = 0;
  private pollAbort: AbortController | null = null;
  private messageHandler: (m: InboundMessage<TelegramMeta>) => void = () => {};
  private offsetFile = join(STATE_DIR, 'telegram-offset.json');
  /** Snapshot recent inbounds in memory so `metro download <line> <id>` can resolve them. */
  private recent = new Map<string, RawMessage>();

  onMessage(handler: (m: InboundMessage<TelegramMeta>) => void): void { this.messageHandler = handler; }

  async start(): Promise<void> {
    await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    const persisted = Number(existsSync(this.offsetFile) ? readFileSync(this.offsetFile, 'utf8').trim() : 0) || 0;
    if (persisted > 0) this.pollOffset = persisted;
    else {
      /* First run: anchor on latest update id (-1 returns most recent without consuming). */
      const initial = await tg<RawUpdate[]>('getUpdates', { offset: -1, timeout: 0 });
      this.pollOffset = initial.length ? initial[0].update_id + 1 : 0;
      this.saveOffset();
    }
    log.info({ offset: this.pollOffset }, 'telegram station: polling started');
    this.pollAbort = new AbortController();
    void this.pollLoop();
  }

  async stop(): Promise<void> { this.pollAbort?.abort(); this.pollAbort = null; }

  async getMe(): Promise<{ id: number; username: string }> {
    const me = await tg<{ id: number; username: string }>('getMe', {});
    this.botUsername = me.username; this.botUserId = me.id;
    return me;
  }

  async send(line: LineT, text: string, opts?: SendOpts): Promise<string> {
    const { chatId, topicId } = targetOf(line);
    const base: Record<string, unknown> = { chat_id: chatId };
    if (topicId !== undefined) base.message_thread_id = topicId;
    if (opts?.replyTo) base.reply_parameters = { message_id: Number(opts.replyTo) };
    return tgSendRich(token(), tg, base, text, opts);
  }

  async edit(line: LineT, messageId: string, text: string, opts?: EditOpts): Promise<void> {
    const { chatId } = targetOf(line);
    const base: Record<string, unknown> = { chat_id: chatId, message_id: Number(messageId), ...NO_PREVIEW };
    if (opts?.buttons) base.reply_markup = opts.buttons.length ? inlineKeyboard(opts.buttons) : { inline_keyboard: [] };
    try { await tg('editMessageText', { ...base, text: mdToTelegramHtml(text), parse_mode: 'HTML' }); }
    catch (err) {
      if (isNoopEdit(err)) return;
      if (!isParseError(err)) throw err;
      log.warn({ err: errMsg(err) }, 'telegram: HTML edit rejected, retrying plain');
      try { await tg('editMessageText', { ...base, text }); }
      catch (e) { if (!isNoopEdit(e)) throw e; }
    }
  }

  async react(line: LineT, messageId: string, emoji: string): Promise<void> {
    await tg('setMessageReaction', {
      chat_id: targetOf(line).chatId, message_id: Number(messageId),
      reaction: emoji ? [{ type: 'emoji', emoji }] : [],
    });
  }

  async download(line: LineT, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]> {
    /* Telegram has no "get message by id" — resolve from the in-memory snapshot. */
    const { chatId } = targetOf(line);
    const m = this.recent.get(`${chatId}:${messageId}`);
    if (!m) return [];
    const refs: { id: string; mime: string }[] = [];
    if (m.photo?.length) refs.push({ id: m.photo[m.photo.length - 1].file_id, mime: 'image/jpeg' });
    if (m.document?.mime_type?.startsWith('image/')) refs.push({ id: m.document.file_id, mime: m.document.mime_type });
    const out: { path: string; mediaType: string }[] = [];
    for (const [i, { id, mime }] of refs.entries()) {
      try {
        const file = await tg<{ file_path: string }>('getFile', { file_id: id });
        const res = await fetch(`${API_BASE}/file/bot${token()}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_BYTES) { log.warn({ id, size: buf.byteLength }, 'telegram: attachment too large'); continue; }
        const path = join(outDir, `${chatId}-${messageId}-${i}.${mime.split('/')[1] ?? 'bin'}`);
        await writeFile(path, buf);
        out.push({ path, mediaType: mime });
      } catch (err) { log.warn({ err: errMsg(err), id }, 'telegram: attachment fetch failed'); }
    }
    return out;
  }

  /** Bot API has no history endpoint — only the in-memory snapshot is reachable. */
  async fetch(): Promise<never[]> { return []; }

  private saveOffset(): void {
    try { writeFileSync(this.offsetFile, String(this.pollOffset)); }
    catch (err) { log.warn({ err: errMsg(err) }, 'telegram offset save failed'); }
  }

  private async pollLoop(): Promise<void> {
    const signal = this.pollAbort?.signal;
    const body = { timeout: 25, allowed_updates: ['message'] };
    while (this.pollAbort && !this.pollAbort.signal.aborted) {
      try {
        const updates = await tg<RawUpdate[]>('getUpdates', { offset: this.pollOffset, ...body },
          { timeoutMs: 60_000, signal });
        for (const u of updates) { this.pollOffset = u.update_id + 1; this.dispatchUpdate(u); }
        if (updates.length) this.saveOffset();
      } catch (err) {
        if (this.pollAbort?.signal.aborted) break;
        log.warn({ err: errMsg(err) }, 'telegram poll error; backing off');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  private dispatchUpdate(u: RawUpdate): void {
    const m = u.message;
    if (!m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return;
    const attachmentNames = attachmentTags(m);
    const text = m.text ?? m.caption ?? '';
    if (!text && !attachmentNames.length) return;
    const topicId = m.is_topic_message ? m.message_thread_id : undefined;
    const fromName = m.from?.username ? `@${m.from.username}` : m.from?.first_name;
    const fromUri = Line.user('telegram', m.from?.id ?? 'unknown');
    const bot = this.botUsername ? `@${this.botUsername}` : undefined;
    log.info({ from: fromName, bot, chat: m.chat.id, topic: topicId, text: text.slice(0, 80) }, 'telegram: inbound');
    if (this.recent.size >= 50) { const first = this.recent.keys().next().value; if (first) this.recent.delete(first); }
    this.recent.set(`${m.chat.id}:${m.message_id}`, m);
    this.messageHandler({
      id: mintId(), ts: new Date((m.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      station: 'telegram', line: Line.telegram(m.chat.id, topicId), messageId: String(m.message_id),
      lineName: topicId === undefined ? (m.chat.title ?? m.chat.first_name ?? undefined) : undefined,
      from: fromUri, fromName, text, attachmentNames, mentionsBot: this.detectMentionsBot(m),
      meta: { isPrivate: m.chat.type === 'private', inForum: !!m.chat.is_forum, isForumTopic: !!m.is_topic_message },
    });
  }

  private detectMentionsBot(m: RawMessage): boolean {
    if (m.chat?.type === 'private') return true;
    const text = m.text ?? m.caption ?? '';
    for (const e of m.entities ?? m.caption_entities ?? []) {
      if (e.type === 'mention' && this.botUsername
        && text.substring(e.offset, e.offset + e.length).toLowerCase() === `@${this.botUsername.toLowerCase()}`) return true;
      if (e.type === 'text_mention' && e.user?.id === this.botUserId) return true;
    }
    return false;
  }
}
