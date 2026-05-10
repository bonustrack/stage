import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from '../paths.js';
import { errMsg, log } from '../log.js';

const API_BASE = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

export async function tg<T = unknown>(method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

export type ChatId = string | number;
export type UrlButton = { text: string; url: string };
export type SendOptions = {
  parseMode?: 'HTML' | 'MarkdownV2';
  disableLinkPreview?: boolean;
  buttons?: UrlButton[][];
};

export function buildSendBody(chatId: ChatId, text: string, opts: SendOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.disableLinkPreview) body.link_preview_options = { is_disabled: true };
  if (opts.buttons?.length) body.reply_markup = { inline_keyboard: opts.buttons };
  return body;
}

export async function getMe(): Promise<{ username: string }> {
  return tg('getMe', {});
}

// FIFO-bounded disk cache, shared between tail.ts (writer) and cli.ts (reader).
type Attachment = { file_id: string; mime: string };
const CACHE_MAX = 200;
const cacheFile = join(STATE_DIR, 'telegram-attachments.json');

function readCache(): Record<string, Attachment[]> {
  try {
    return existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'telegram attachment cache read failed');
    return {};
  }
}

function cacheAttachment(chatId: ChatId, messageId: number, att: Attachment): void {
  try {
    const data = readCache();
    const key = `${chatId}:${messageId}`;
    data[key] = [...(data[key] ?? []), att];
    const keys = Object.keys(data);
    for (const stale of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete data[stale];
    writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'telegram attachment cache write failed');
  }
}

export function getCachedAttachments(chatId: ChatId, messageId: number): Attachment[] {
  return readCache()[`${chatId}:${messageId}`] ?? [];
}

export async function downloadAttachment(fileId: string, mime: string): Promise<{ data: string; mime: string }> {
  const file = await tg<{ file_path: string }>('getFile', { file_id: fileId });
  const res = await fetch(`${API_BASE}/file/bot${token()}/${file.file_path}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Trust the cached mime — it's the authoritative one from the message
  // metadata (`image/jpeg` for photos, the document's mime_type for files).
  // The Telegram CDN often returns `application/octet-stream` as Content-Type,
  // which would otherwise wipe out our extension classification downstream.
  return { data: buf.toString('base64'), mime };
}

// Structural subset of a Telegram Message we actually look at.
type Photo = { file_id: string };
type FileWithMime = { file_id: string; mime_type?: string };
type RawMessage = {
  message_id: number;
  chat?: { id: number };
  text?: string;
  caption?: string;
  photo?: Photo[];
  document?: FileWithMime;
  voice?: FileWithMime;
  audio?: FileWithMime;
};
type RawUpdate = { update_id: number; message?: RawMessage };

async function messageToText(m: RawMessage, chatId: ChatId): Promise<string | null> {
  if (m.text) return m.text;
  const caption: string = m.caption ?? '';

  if (m.photo?.length) {
    const photo = m.photo[m.photo.length - 1];
    cacheAttachment(chatId, m.message_id, { file_id: photo.file_id, mime: 'image/jpeg' });
    return [caption, '[image]'].filter(Boolean).join(' ');
  }
  if (m.document?.mime_type?.startsWith('image/')) {
    cacheAttachment(chatId, m.message_id, { file_id: m.document.file_id, mime: m.document.mime_type });
    return [caption, '[image]'].filter(Boolean).join(' ');
  }

  if (m.voice) return [caption, '[voice]'].filter(Boolean).join(' ');
  if (m.audio) return [caption, '[audio]'].filter(Boolean).join(' ');

  return caption || null;
}

export type InboundMessage = { chat_id: ChatId; message_id: number; text: string };

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

export async function startPolling(): Promise<void> {
  // A registered webhook short-circuits getUpdates — clear it defensively.
  await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});

  let offset = 0;
  const initial = await tg<RawUpdate[]>('getUpdates', { timeout: 0 });
  if (initial.length) offset = initial[initial.length - 1].update_id + 1;

  while (true) {
    try {
      const updates = await tg<RawUpdate[]>('getUpdates', { offset, timeout: 50 }, 60_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        void dispatchUpdate(u);
      }
    } catch (err) {
      log.error({ err: errMsg(err) }, 'telegram poll error');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function dispatchUpdate(u: RawUpdate): Promise<void> {
  const m = u.message;
  if (!m?.chat?.id || typeof m.message_id !== 'number') return;
  const base = { chat_id: m.chat.id, message_id: m.message_id };
  try {
    const text = await messageToText(m, m.chat.id);
    if (text === null) return;
    onInboundHandler({ ...base, text });
  } catch (err) {
    onInboundHandler({ ...base, text: `[message processing failed: ${errMsg(err)}]` });
  }
}
