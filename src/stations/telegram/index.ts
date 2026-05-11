/** Telegram station: long-poll bot API; sends agent-style markdown as HTML with plain-text fallback. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../../log.js';
import { mdToTelegramHtml } from './format.js';
import { fetchAttachments } from './files.js';
import * as Line from '../line.js';
import { STATE_DIR } from '../../paths.js';
import type { Capabilities, ChatStation, InboundMessage, Line as LineT, SendOpts } from '../types.js';

const API_BASE = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

async function tg<T = unknown>(method: string, body: unknown, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const signals: AbortSignal[] = [AbortSignal.timeout(opts.timeoutMs ?? 30_000)];
  if (opts.signal) signals.push(opts.signal);
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any(signals) });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

export type TelegramMeta = { isPrivate: boolean; inForum: boolean; isForumTopic: boolean };

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type FileWithMime = { file_id: string; mime_type?: string };
type RawMessage = {
  message_id: number; chat?: { id: number; type?: string; is_forum?: boolean };
  message_thread_id?: number; is_topic_message?: boolean;
  text?: string; caption?: string; entities?: Entity[]; caption_entities?: Entity[];
  photo?: { file_id: string }[]; document?: FileWithMime; voice?: FileWithMime; audio?: FileWithMime;
  from?: { is_bot?: boolean; username?: string; first_name?: string };
};
type RawUpdate = { update_id: number; message?: RawMessage; callback_query?: { id: string; data?: string } };

const isParseError = (err: unknown): boolean => errMsg(err).includes("can't parse entities");
const NO_PREVIEW = { link_preview_options: { is_disabled: true } };
const stopButtonMarkup = (stopId: string): { inline_keyboard: { text: string; callback_data: string }[][] } =>
  ({ inline_keyboard: [[{ text: '⏹', callback_data: stopId }]] });

const targetOf = (line: LineT): { chatId: number; topicId?: number } => {
  const t = Line.parseTelegram(line);
  if (!t) throw new Error(`not a telegram line: ${line}`);
  return t;
};

export class TelegramStation implements ChatStation<TelegramMeta> {
  readonly name = 'telegram';
  readonly capabilities: Capabilities = {
    in: ['text', 'image'], out: ['text'],
    features: ['stream', 'edit', 'attachments'],
  };

  private botUsername: string | null = null;
  private botUserId: number | null = null;
  private pollOffset = 0;
  private pollAbort: AbortController | null = null;
  private messageHandler: (m: InboundMessage<TelegramMeta>) => void = () => {};
  private stopHandler: (stopId: string) => Promise<boolean> = async () => false;

  private offsetFile = join(STATE_DIR, 'telegram-offset.json');

  onMessage(handler: (m: InboundMessage<TelegramMeta>) => void): void { this.messageHandler = handler; }
  onStop(handler: (stopId: string) => Promise<boolean>): void { this.stopHandler = handler; }

  async start(): Promise<void> {
    await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    const persisted = this.loadOffset();
    if (persisted > 0) this.pollOffset = persisted;
    else {
      /** First run: anchor on latest update id (-1 returns most recent without consuming). */
      const initial = await tg<RawUpdate[]>('getUpdates', { offset: -1, timeout: 0 });
      this.pollOffset = initial.length ? initial[0].update_id + 1 : 0;
      this.saveOffset(this.pollOffset);
    }
    log.info({ offset: this.pollOffset }, 'telegram station: polling started');
    this.pollAbort = new AbortController(); void this.pollLoop();
  }

  async stop(): Promise<void> { this.pollAbort?.abort(); this.pollAbort = null; }

  async getMe(): Promise<{ id: number; username: string }> {
    const me = await tg<{ id: number; username: string }>('getMe', {});
    this.botUsername = me.username; this.botUserId = me.id;
    return me;
  }

  /** Send agent-style markdown as Telegram HTML, falling back to plain text on parse errors. */
  async send(line: LineT, text: string, opts?: SendOpts): Promise<string> {
    const { chatId, topicId } = targetOf(line);
    const base: Record<string, unknown> = { chat_id: chatId, ...NO_PREVIEW };
    if (topicId !== undefined) base.message_thread_id = topicId;
    if (opts?.replyTo) base.reply_parameters = { message_id: Number(opts.replyTo) };
    if (opts?.stopId) base.reply_markup = stopButtonMarkup(opts.stopId);
    const post = (t: string, html: boolean): Promise<{ message_id: number }> =>
      tg<{ message_id: number }>('sendMessage', html ? { ...base, text: mdToTelegramHtml(t), parse_mode: 'HTML' } : { ...base, text: t });
    try { return String((await post(text, true)).message_id); }
    catch (err) {
      if (!isParseError(err)) throw err;
      log.warn({ err: errMsg(err) }, 'telegram: HTML rejected, sending plain');
      return String((await post(text, false)).message_id);
    }
  }

  async edit(line: LineT, messageId: string, text: string, opts?: SendOpts): Promise<void> {
    const { chatId } = targetOf(line);
    const base = { chat_id: chatId, message_id: Number(messageId), ...NO_PREVIEW,
      reply_markup: opts?.stopId ? stopButtonMarkup(opts.stopId) : { inline_keyboard: [] } };
    const skipNoop = (err: unknown): boolean => errMsg(err).includes('message is not modified');
    try { await tg('editMessageText', { ...base, text: mdToTelegramHtml(text), parse_mode: 'HTML' }); }
    catch (err) {
      if (skipNoop(err)) return;
      if (!isParseError(err)) throw err;
      log.warn({ err: errMsg(err) }, 'telegram: HTML edit rejected, retrying plain');
      try { await tg('editMessageText', { ...base, text }); } catch (e) { if (!skipNoop(e)) throw e; }
    }
  }

  /** Create a forum topic; requires `can_manage_topics` admin permission. Returns the new topic's Line. */
  async createForumTopic(line: LineT, name: string): Promise<LineT> {
    const { chatId } = targetOf(line);
    const r = await tg<{ message_thread_id: number }>('createForumTopic', { chat_id: chatId, name: name.slice(0, 128) || 'metro' });
    return Line.telegram(chatId, r.message_thread_id);
  }

  /** Deep link `t.me/c/<id>/<topic>`; strips supergroup's `-100` prefix. */
  topicLink(line: LineT): string | null {
    const t = Line.parseTelegram(line); if (!t?.topicId) return null;
    return `https://t.me/c/${String(Math.abs(t.chatId)).replace(/^100/, '')}/${t.topicId}`;
  }

  private loadOffset = (): number => {
    try { return existsSync(this.offsetFile) ? Number(readFileSync(this.offsetFile, 'utf8').trim()) || 0 : 0; } catch { return 0; }
  };
  private saveOffset = (o: number): void => {
    try { writeFileSync(this.offsetFile, String(o)); } catch (err) { log.warn({ err: errMsg(err) }, 'telegram offset save failed'); }
  };

  private async pollLoop(): Promise<void> {
    const abortSignal = this.pollAbort?.signal;
    const body = { timeout: 25, allowed_updates: ['message', 'callback_query'] };
    while (this.pollAbort && !this.pollAbort.signal.aborted) {
      try {
        const updates = await tg<RawUpdate[]>('getUpdates', { offset: this.pollOffset, ...body }, { timeoutMs: 60_000, signal: abortSignal });
        for (const u of updates) { this.pollOffset = u.update_id + 1; await this.dispatchUpdate(u); }
        if (updates.length) this.saveOffset(this.pollOffset);
      } catch (err) {
        if (this.pollAbort?.signal.aborted) break;
        log.warn({ err: errMsg(err) }, 'telegram poll error; backing off');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  private async dispatchUpdate(u: RawUpdate): Promise<void> {
    if (u.callback_query) return this.handleCallback(u.callback_query);
    const m = u.message;
    if (!m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return;
    const attachments = await fetchAttachments(m, token(), (method, body) => tg(method, body));
    const text = messageToText(m, attachments.length > 0);
    if (!text && !attachments.length) return;
    const topicId = m.is_topic_message ? m.message_thread_id : undefined;
    log.info({ from: m.from?.username ? `@${m.from.username}` : m.from?.first_name, bot: this.botUsername ? `@${this.botUsername}` : undefined, chat: m.chat.id, topic: topicId, text: text.slice(0, 80) }, 'telegram: inbound');
    this.messageHandler({
      station: 'telegram', line: Line.telegram(m.chat.id, topicId), messageId: String(m.message_id),
      text, attachments, mentionsBot: this.detectMentionsBot(m),
      meta: { isPrivate: m.chat.type === 'private', inForum: !!m.chat.is_forum, isForumTopic: !!m.is_topic_message },
    });
  }

  private async handleCallback(q: NonNullable<RawUpdate['callback_query']>): Promise<void> {
    if (q.data?.startsWith('stop-')) await this.stopHandler(q.data).catch(err => log.warn({ err: errMsg(err) }, 'telegram stop handler threw'));
    await tg('answerCallbackQuery', { callback_query_id: q.id }).catch(err => log.warn({ err: errMsg(err) }, 'telegram answerCallbackQuery failed'));
  }

  private detectMentionsBot(m: RawMessage): boolean {
    if (m.chat?.type === 'private') return true;
    const text = m.text ?? m.caption ?? '';
    for (const e of m.entities ?? m.caption_entities ?? []) {
      if (e.type === 'mention' && this.botUsername && text.substring(e.offset, e.offset + e.length).toLowerCase() === `@${this.botUsername.toLowerCase()}`) return true;
      if (e.type === 'text_mention' && e.user?.id === this.botUserId) return true;
    }
    return false;
  }
}

/** Caption + a `[image|voice|audio]` placeholder when no real attachment was fetched. */
function messageToText(m: RawMessage, gotImage: boolean): string {
  if (m.text) return m.text;
  const caption = m.caption ?? '';
  const isImage = m.photo?.length || m.document?.mime_type?.startsWith('image/');
  const tag = isImage && !gotImage ? '[image]' : m.voice ? '[voice]' : m.audio ? '[audio]' : '';
  return [caption, tag].filter(Boolean).join(' ');
}
