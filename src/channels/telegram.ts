import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Attachment } from '../agents/types.js';
import { STATE_DIR } from '../paths.js';
import { errMsg, log } from '../log.js';
import { mdToTelegramHtml } from '../helpers/telegram-format.js';
import { fetchAttachments } from '../helpers/telegram-files.js';

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

export type ChatId = string | number;

let botUsername: string | null = null;
let botUserId: number | null = null;

export async function getMe(): Promise<{ id: number; username: string }> {
  const me = await tg<{ id: number; username: string }>('getMe', {});
  botUsername = me.username;
  botUserId = me.id;
  return me;
}

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type FileWithMime = { file_id: string; mime_type?: string };
type RawMessage = {
  message_id: number;
  chat?: { id: number; type?: string; is_forum?: boolean };
  message_thread_id?: number;
  is_topic_message?: boolean;
  text?: string; caption?: string;
  entities?: Entity[]; caption_entities?: Entity[];
  photo?: { file_id: string }[]; document?: FileWithMime; voice?: FileWithMime; audio?: FileWithMime;
  from?: { is_bot?: boolean };
};
type RawCallbackQuery = { id: string; data?: string };
type RawUpdate = { update_id: number; message?: RawMessage; callback_query?: RawCallbackQuery };

export type InboundMessage = {
  chat_id: number;
  message_id: number;
  message_thread_id?: number;
  text: string;
  attachments: Attachment[];
  is_private: boolean;
  is_forum_topic: boolean;
  in_forum: boolean;
  mentions_bot: boolean;
};

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export const onInbound = (handler: (msg: InboundMessage) => void): void => { onInboundHandler = handler; };

let onStopHandler: (stopId: string) => Promise<boolean> = async () => false;
export const onStop = (handler: (stopId: string) => Promise<boolean>): void => { onStopHandler = handler; };

const offsetFile = join(STATE_DIR, 'telegram-offset.json');
let pollOffset = 0;
let pollAbort: AbortController | null = null;

const loadOffset = (): number => {
  try { return existsSync(offsetFile) ? Number(readFileSync(offsetFile, 'utf8').trim()) || 0 : 0; } catch { return 0; }
};
const saveOffset = (o: number): void => {
  try { writeFileSync(offsetFile, String(o)); } catch (err) { log.warn({ err: errMsg(err) }, 'telegram offset save failed'); }
};

export async function startPolling(): Promise<void> {
  await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
  const persisted = loadOffset();
  if (persisted > 0) pollOffset = persisted;
  else {
    /** First run: anchor on latest update id (-1 returns most recent without consuming). */
    const initial = await tg<RawUpdate[]>('getUpdates', { offset: -1, timeout: 0 });
    pollOffset = initial.length ? initial[0].update_id + 1 : 0;
    saveOffset(pollOffset);
  }
  log.info({ offset: pollOffset }, 'telegram polling: started');
  pollAbort = new AbortController();
  void pollLoop();
}

async function pollLoop(): Promise<void> {
  const abortSignal = pollAbort?.signal;
  /** `allowed_updates` must list every kind we want; default excludes callback_query. */
  const body = { timeout: 25, allowed_updates: ['message', 'callback_query'] };
  while (pollAbort && !pollAbort.signal.aborted) {
    try {
      const updates = await tg<RawUpdate[]>('getUpdates', { offset: pollOffset, ...body }, { timeoutMs: 60_000, signal: abortSignal });
      for (const u of updates) { pollOffset = u.update_id + 1; await dispatchUpdate(u); }
      if (updates.length) saveOffset(pollOffset);
    } catch (err) {
      if (pollAbort?.signal.aborted) break;
      log.warn({ err: errMsg(err) }, 'telegram poll error; backing off');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export const shutdownPolling = async (): Promise<void> => { pollAbort?.abort(); pollAbort = null; };

async function dispatchUpdate(u: RawUpdate): Promise<void> {
  if (u.callback_query) return handleCallback(u.callback_query);
  const m = u.message;
  if (!m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return;
  const attachments = await fetchAttachments(m, token(), (method, body) => tg(method, body));
  const text = messageToText(m, attachments.length > 0);
  if (!text && !attachments.length) return;
  onInboundHandler({
    chat_id: m.chat.id, message_id: m.message_id, message_thread_id: m.is_topic_message ? m.message_thread_id : undefined,
    text, attachments,
    is_private: m.chat.type === 'private', is_forum_topic: !!m.is_topic_message, in_forum: !!m.chat.is_forum,
    mentions_bot: detectMentionsBot(m),
  });
}

/** Inline-keyboard button press → orchestrator stop handler, then acknowledge the callback. */
const handleCallback = async (q: RawCallbackQuery): Promise<void> => {
  if (q.data?.startsWith('stop-')) await onStopHandler(q.data).catch(err => log.warn({ err: errMsg(err) }, 'telegram stop handler threw'));
  await tg('answerCallbackQuery', { callback_query_id: q.id }).catch(err => log.warn({ err: errMsg(err) }, 'telegram answerCallbackQuery failed'));
}

function detectMentionsBot(m: RawMessage): boolean {
  if (m.chat?.type === 'private') return true;
  const text = m.text ?? m.caption ?? '';
  for (const e of m.entities ?? m.caption_entities ?? []) {
    if (e.type === 'mention' && botUsername && text.substring(e.offset, e.offset + e.length).toLowerCase() === `@${botUsername.toLowerCase()}`) return true;
    if (e.type === 'text_mention' && e.user?.id === botUserId) return true;
  }
  return false;
}

/** Caption + a `[image|voice|audio]` placeholder when no real attachment was fetched. */
function messageToText(m: RawMessage, gotImage: boolean): string {
  if (m.text) return m.text;
  const caption = m.caption ?? '';
  const isImage = m.photo?.length || m.document?.mime_type?.startsWith('image/');
  const tag = isImage && !gotImage ? '[image]' : m.voice ? '[voice]' : m.audio ? '[audio]' : '';
  return [caption, tag].filter(Boolean).join(' ');
}

/** Create a forum topic; requires `can_manage_topics` admin permission. */
export const createForumTopic = async (chatId: ChatId, name: string): Promise<number> =>
  (await tg<{ message_thread_id: number }>('createForumTopic', { chat_id: chatId, name: name.slice(0, 128) || 'metro' })).message_thread_id;

/** Deep link `t.me/c/<id>/<topic>`; strips supergroup's `-100` prefix from chat id. */
export const topicLink = (chatId: number, topicId: number): string =>
  `https://t.me/c/${String(Math.abs(chatId)).replace(/^100/, '')}/${topicId}`;

const isParseError = (err: unknown): boolean => errMsg(err).includes("can't parse entities");

const NO_PREVIEW = { link_preview_options: { is_disabled: true } };

/** Send attaches `reply_markup` only when stopId is set; edit always attaches it (empty array clears). */
const stopButtonMarkup = (stopId: string): { inline_keyboard: { text: string; callback_data: string }[][] } =>
  ({ inline_keyboard: [[{ text: '⏹', callback_data: stopId }]] });

/** Send agent-style markdown as Telegram HTML, falling back to plain text on parse errors. */
export async function sendMessage(chatId: ChatId, threadId: number | undefined, text: string, replyToMessageId?: number, stopId: string | null = null): Promise<number> {
  const base: Record<string, unknown> = { chat_id: chatId, ...NO_PREVIEW };
  if (threadId !== undefined) base.message_thread_id = threadId;
  if (replyToMessageId !== undefined) base.reply_parameters = { message_id: replyToMessageId };
  if (stopId) base.reply_markup = stopButtonMarkup(stopId);
  try {
    return (await tg<{ message_id: number }>('sendMessage', { ...base, text: mdToTelegramHtml(text), parse_mode: 'HTML' })).message_id;
  } catch (err) {
    if (!isParseError(err)) throw err;
    log.warn({ err: errMsg(err) }, 'telegram: HTML rejected, sending plain');
    return (await tg<{ message_id: number }>('sendMessage', { ...base, text })).message_id;
  }
}

export async function editMessageText(chatId: ChatId, messageId: number, text: string, stopId: string | null = null): Promise<void> {
  const base = { chat_id: chatId, message_id: messageId, ...NO_PREVIEW, reply_markup: stopId ? stopButtonMarkup(stopId) : { inline_keyboard: [] } };
  const skipNoop = (err: unknown): boolean => errMsg(err).includes('message is not modified');
  try { await tg('editMessageText', { ...base, text: mdToTelegramHtml(text), parse_mode: 'HTML' }); }
  catch (err) {
    if (skipNoop(err)) return;
    if (!isParseError(err)) throw err;
    log.warn({ err: errMsg(err) }, 'telegram: HTML edit rejected, retrying plain');
    try { await tg('editMessageText', { ...base, text }); } catch (e) { if (!skipNoop(e)) throw e; }
  }
}
