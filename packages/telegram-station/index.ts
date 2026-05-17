/** Telegram station — long-poll Bot API; raw fetch only (no SDK). */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdirSync, writeFile } from 'node:fs';
import { writeFile as writeFileAsync } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Line, mintId, type Envelope, type Station } from '@stage-labs/metro';
import { mdToTelegramHtml } from './md.js';
import { inlineKeyboard, tgSendRich, type Button, type RichOpts } from './upload.js';

const API = 'https://api.telegram.org';
const NO_PREVIEW = { link_preview_options: { is_disabled: true } };
const MAX_BYTES = 20 * 1024 * 1024;

const stateDir = (): string => process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
const offsetFile = (): string => join(stateDir(), 'telegram-offset.json');

const tok = (): string => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
};

async function tg<T = unknown>(method: string, body: unknown, opts: { signal?: AbortSignal } = {}): Promise<T> {
  const signals: AbortSignal[] = [AbortSignal.timeout(60_000)];
  if (opts.signal) signals.push(opts.signal);
  const res = await fetch(`${API}/bot${tok()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.any(signals),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type Photo = { file_id: string };
type Doc = { file_id: string; mime_type?: string; file_name?: string };
type TgPayload = {
  message_id: number; date?: number;
  chat?: { id: number; type?: string; is_forum?: boolean; title?: string; first_name?: string };
  message_thread_id?: number; is_topic_message?: boolean;
  text?: string; caption?: string; entities?: Entity[]; caption_entities?: Entity[];
  photo?: Photo[]; document?: Doc; voice?: Doc; audio?: Doc;
  from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string };
  reply_to_message?: TgPayload;
};
type ReactionType = { type: 'emoji'; emoji: string } | { type: 'custom_emoji'; custom_emoji_id: string };
type Reaction = {
  chat: { id: number; type?: string; title?: string; first_name?: string };
  message_id: number; user?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  date?: number; old_reaction: ReactionType[]; new_reaction: ReactionType[];
};
type Update = { update_id: number; message?: TgPayload; message_reaction?: Reaction };

const isNoopEdit = (err: unknown): boolean =>
  err instanceof Error && err.message.includes('message is not modified');
const isParseError = (err: unknown): boolean =>
  err instanceof Error && err.message.includes("can't parse entities");

const targetOf = (line: string): { chatId: number; topicId?: number } => {
  const t = Line.parseTelegram(line as Line);
  if (!t) throw new Error(`not a telegram line: ${line}`);
  return t;
};

function attachmentTags(m: TgPayload): string[] {
  const out: string[] = [];
  if (m.photo?.length) out.push('[image]');
  if (m.document?.mime_type?.startsWith('image/')) out.push('[image]');
  else if (m.document) out.push(`[file: ${m.document.file_name ?? m.document.file_id}]`);
  if (m.voice) out.push('[voice]');
  if (m.audio) out.push('[audio]');
  return out;
}

let pollOffset = 0;
let pollAbort: AbortController | null = null;
let emit: ((e: Envelope) => void) | null = null;
const recent = new Map<string, TgPayload>();

const station: Station = {
  name: 'telegram',

  configured: () => !!process.env.TELEGRAM_BOT_TOKEN,

  async start(e) {
    emit = e;
    mkdirSync(stateDir(), { recursive: true });
    await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    const persisted = Number(existsSync(offsetFile()) ? readFileSync(offsetFile(), 'utf8').trim() : 0) || 0;
    if (persisted > 0) pollOffset = persisted;
    else {
      const initial = await tg<Update[]>('getUpdates', { offset: -1, timeout: 0 });
      pollOffset = initial.length ? initial[0].update_id + 1 : 0;
      saveOffset();
    }
    pollAbort = new AbortController();
    void pollLoop();
  },

  async stop() {
    pollAbort?.abort();
    pollAbort = null;
    emit = null;
    recent.clear();
  },

  actions: {
    async reply({ line, messageId, text, ...opts }: SendActionArgs & { messageId: string }) {
      return { messageId: await sendRich(line, text, { ...opts, replyTo: messageId }) };
    },
    async send({ line, text, ...opts }: SendActionArgs) {
      return { messageId: await sendRich(line, text, opts) };
    },
    async react({ line, messageId, emoji }: { line: string; messageId: string; emoji: string }) {
      await tg('setMessageReaction', {
        chat_id: targetOf(line).chatId, message_id: Number(messageId),
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
      });
      return { ok: true };
    },
    async edit({ line, messageId, text, buttons }: { line: string; messageId: string; text: string; buttons?: Button[][] }) {
      const { chatId } = targetOf(line);
      const base: Record<string, unknown> = { chat_id: chatId, message_id: Number(messageId), ...NO_PREVIEW };
      if (buttons) base.reply_markup = buttons.length ? inlineKeyboard(buttons) : { inline_keyboard: [] };
      try { await tg('editMessageText', { ...base, text: mdToTelegramHtml(text), parse_mode: 'HTML' }); }
      catch (err) {
        if (isNoopEdit(err)) return { ok: true };
        if (!isParseError(err)) throw err;
        try { await tg('editMessageText', { ...base, text }); }
        catch (e) { if (!isNoopEdit(e)) throw e; }
      }
      return { ok: true };
    },
    async download({ line, messageId, outDir }: { line: string; messageId: string; outDir: string }) {
      return { files: await downloadAttachments(line, messageId, outDir) };
    },
    async fetch() { return { messages: [] }; },
    async getMe() { return tg<{ id: number; username: string }>('getMe', {}); },
  },
};

type SendActionArgs = {
  line: string; text: string;
  images?: string[]; documents?: string[]; voice?: string; buttons?: Button[][];
};

async function sendRich(line: string, text: string, opts: Partial<RichOpts> & { replyTo?: string }): Promise<string> {
  const { chatId, topicId } = targetOf(line);
  const base: Record<string, unknown> = { chat_id: chatId };
  if (topicId !== undefined) base.message_thread_id = topicId;
  if (opts.replyTo) base.reply_parameters = { message_id: Number(opts.replyTo) };
  return tgSendRich(tok(), tg, base, text, opts);
}

async function downloadAttachments(line: string, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]> {
  const { chatId } = targetOf(line);
  const m = recent.get(`${chatId}:${messageId}`);
  if (!m) return [];
  const refs: { id: string; mime: string }[] = [];
  if (m.photo?.length) refs.push({ id: m.photo[m.photo.length - 1].file_id, mime: 'image/jpeg' });
  if (m.document?.mime_type?.startsWith('image/')) refs.push({ id: m.document.file_id, mime: m.document.mime_type });
  const out: { path: string; mediaType: string }[] = [];
  for (const [i, { id, mime }] of refs.entries()) {
    try {
      const file = await tg<{ file_path: string }>('getFile', { file_id: id });
      const res = await fetch(`${API}/file/bot${tok()}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) continue;
      const path = join(outDir, `${chatId}-${messageId}-${i}.${mime.split('/')[1] ?? 'bin'}`);
      await writeFileAsync(path, buf);
      out.push({ path, mediaType: mime });
    } catch { /* ignore individual failures */ }
  }
  return out;
}

function saveOffset(): void {
  try {
    mkdirSync(dirname(offsetFile()), { recursive: true });
    writeFile(offsetFile(), String(pollOffset), () => {});
    writeFileSync(offsetFile(), String(pollOffset));
  } catch { /* best-effort */ }
}

function dispatchReaction(r: Reaction): void {
  if (!emit || !r.user || r.user.is_bot) return;
  const emojisOf = (xs: ReactionType[]): string[] =>
    xs.filter((x): x is { type: 'emoji'; emoji: string } => x.type === 'emoji').map(x => x.emoji);
  const had = new Set(emojisOf(r.old_reaction));
  const added = emojisOf(r.new_reaction).filter(e => !had.has(e));
  if (!added.length) return;
  const fromName = r.user.username ? `@${r.user.username}` : r.user.first_name;
  const ts = new Date((r.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
  for (const emoji of added) emit({
    id: mintId(), ts, kind: 'reaction', station: 'telegram', line: Line.telegram(r.chat.id),
    lineName: r.chat.title ?? r.chat.first_name ?? undefined,
    from: Line.user('telegram', r.user.id), fromName,
    messageId: String(r.message_id), emoji, isPrivate: r.chat.type === 'private',
  });
}

function dispatchUpdate(u: Update): void {
  if (u.message_reaction) { dispatchReaction(u.message_reaction); return; }
  const m = u.message;
  if (!emit || !m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return;
  const text = [m.text ?? m.caption, ...attachmentTags(m)].filter(Boolean).join(' ');
  if (!text) return;
  const topicId = m.is_topic_message ? m.message_thread_id : undefined;
  const fromName = m.from?.username ? `@${m.from.username}` : m.from?.first_name;
  if (recent.size >= 50) { const first = recent.keys().next().value; if (first) recent.delete(first); }
  recent.set(`${m.chat.id}:${m.message_id}`, m);
  emit({
    id: mintId(), ts: new Date((m.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    kind: 'message', station: 'telegram', line: Line.telegram(m.chat.id, topicId), messageId: String(m.message_id),
    lineName: topicId === undefined ? (m.chat.title ?? m.chat.first_name ?? undefined) : undefined,
    from: Line.user('telegram', m.from?.id ?? 'unknown'), fromName, text, payload: m,
    isPrivate: m.chat.type === 'private',
  });
}

async function pollLoop(): Promise<void> {
  const signal = pollAbort?.signal;
  while (pollAbort && !pollAbort.signal.aborted) {
    try {
      const updates = await tg<Update[]>('getUpdates',
        { offset: pollOffset, timeout: 25, allowed_updates: ['message', 'message_reaction'] }, { signal });
      for (const u of updates) { pollOffset = u.update_id + 1; dispatchUpdate(u); }
      if (updates.length) saveOffset();
    } catch {
      if (pollAbort?.signal.aborted) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export default station;
