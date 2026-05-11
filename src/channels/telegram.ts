import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from '../paths.js';
import { errMsg, log } from '../log.js';
import { mdToTelegramHtml } from '../lib/telegram-format.js';

const API_BASE = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

async function tg<T = unknown>(
  method: string,
  body: unknown,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const timeout = opts.timeoutMs ?? 30_000;
  const signals: AbortSignal[] = [AbortSignal.timeout(timeout)];
  if (opts.signal) signals.push(opts.signal);
  const signal = AbortSignal.any(signals);
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

export type ChatId = string | number;

// ---------- Identity (cached after getMe) ----------------------------------

let botUsername: string | null = null;
let botUserId: number | null = null;

export async function getMe(): Promise<{ id: number; username: string }> {
  const me = await tg<{ id: number; username: string }>('getMe', {});
  botUsername = me.username;
  botUserId = me.id;
  return me;
}

// ---------- Inbound (long-polling) -----------------------------------------

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type Photo = { file_id: string; width?: number; height?: number; file_size?: number };
type FileWithMime = { file_id: string; mime_type?: string; file_name?: string };
type RawMessage = {
  message_id: number;
  chat?: { id: number; type?: string; is_forum?: boolean };
  message_thread_id?: number;
  is_topic_message?: boolean;
  text?: string;
  caption?: string;
  entities?: Entity[];
  caption_entities?: Entity[];
  photo?: Photo[];
  document?: FileWithMime;
  voice?: FileWithMime;
  audio?: FileWithMime;
  from?: { is_bot?: boolean };
};
type RawUpdate = { update_id: number; message?: RawMessage };

/**
 * Reference to a media attachment on a Telegram message. `file_id` is the
 * opaque Telegram handle — resolve to bytes via `downloadFile`. Voice notes,
 * audio files, and photos all flow through this; the channel layer tags the
 * kind so the orchestrator knows whether to label it as image vs audio when
 * routing to an agent that only natively handles one of them.
 */
export type AttachmentRef = {
  kind: 'image' | 'audio';
  file_id: string;
  /** Best-known MIME — Telegram provides it on `document`/`audio`/`voice`,
   * not on `photo` (photos are always JPEG, set explicitly). */
  mimeType: string;
  /** Original filename if Telegram exposes one (documents/audio). */
  name?: string;
};

export type InboundMessage = {
  chat_id: number;
  message_id: number;
  /** Forum-topic id (undefined for DMs and forum General). */
  message_thread_id?: number;
  text: string;
  is_private: boolean;
  /** Belongs to a non-General forum topic (has message_thread_id). */
  is_forum_topic: boolean;
  /** Chat is a forum supergroup (any topic, including General). */
  in_forum: boolean;
  mentions_bot: boolean;
  attachments: AttachmentRef[];
};

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

const offsetFile = join(STATE_DIR, 'telegram-offset.json');
let pollOffset = 0;
let pollAbort: AbortController | null = null;

function loadOffset(): number {
  try {
    if (!existsSync(offsetFile)) return 0;
    return Number(readFileSync(offsetFile, 'utf8').trim()) || 0;
  } catch { return 0; }
}

function saveOffset(o: number): void {
  try { writeFileSync(offsetFile, String(o)); } catch (err) {
    log.warn({ err: errMsg(err) }, 'telegram offset save failed');
  }
}

export async function startPolling(): Promise<void> {
  // A registered webhook short-circuits getUpdates — clear it defensively.
  await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});

  const persisted = loadOffset();
  if (persisted > 0) {
    // Resume from where we left off — telegram queues updates for ~24h, so
    // any messages sent while metro was down come back through this poll.
    pollOffset = persisted;
    log.info({ offset: pollOffset }, 'telegram polling: resuming from persisted offset');
  } else {
    // First-ever run: skip historical backlog by anchoring on the latest
    // update id (-1 returns just the most recent one without consuming it).
    const initial = await tg<RawUpdate[]>('getUpdates', { offset: -1, timeout: 0 });
    pollOffset = initial.length ? initial[0].update_id + 1 : 0;
    saveOffset(pollOffset);
    log.info({ offset: pollOffset }, 'telegram polling: starting fresh');
  }

  pollAbort = new AbortController();
  void pollLoop();
}

async function pollLoop(): Promise<void> {
  const abortSignal = pollAbort?.signal;
  while (pollAbort && !pollAbort.signal.aborted) {
    try {
      const updates = await tg<RawUpdate[]>(
        'getUpdates',
        { offset: pollOffset, timeout: 25 },
        { timeoutMs: 60_000, signal: abortSignal },
      );
      for (const u of updates) {
        pollOffset = u.update_id + 1;
        await dispatchUpdate(u);
      }
      if (updates.length) saveOffset(pollOffset);
    } catch (err) {
      if (pollAbort?.signal.aborted) break;
      log.warn({ err: errMsg(err) }, 'telegram poll error; backing off');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  log.info('telegram polling stopped');
}

export async function shutdownPolling(): Promise<void> {
  pollAbort?.abort();
  pollAbort = null;
}

async function dispatchUpdate(u: RawUpdate): Promise<void> {
  const m = u.message;
  if (!m?.chat?.id || typeof m.message_id !== 'number') {
    log.trace({ update_id: u.update_id }, 'telegram: non-message update');
    return;
  }
  if (m.from?.is_bot) {
    log.trace({ chat: m.chat.id }, 'telegram: skipping bot author');
    return;
  }

  const { text, attachments } = extractMedia(m);
  if (!text && attachments.length === 0) {
    log.trace({ chat: m.chat.id }, 'telegram: no text/caption/media');
    return;
  }

  const msg: InboundMessage = {
    chat_id: m.chat.id,
    message_id: m.message_id,
    message_thread_id: m.is_topic_message ? m.message_thread_id : undefined,
    text,
    is_private: m.chat.type === 'private',
    is_forum_topic: !!m.is_topic_message,
    in_forum: !!m.chat.is_forum,
    mentions_bot: detectMentionsBot(m),
    attachments,
  };
  log.debug({
    chat: msg.chat_id,
    topic: msg.message_thread_id,
    is_private: msg.is_private,
    is_forum_topic: msg.is_forum_topic,
    in_forum: msg.in_forum,
    mentions_bot: msg.mentions_bot,
  }, 'telegram: inbound');
  onInboundHandler(msg);
}

function detectMentionsBot(m: RawMessage): boolean {
  // In DMs, every message to the bot is implicitly addressed to it.
  if (m.chat?.type === 'private') return true;
  const text = m.text ?? m.caption ?? '';
  const entities = m.entities ?? m.caption_entities ?? [];
  for (const e of entities) {
    if (e.type === 'mention' && botUsername) {
      const slice = text.substring(e.offset, e.offset + e.length);
      if (slice.toLowerCase() === `@${botUsername.toLowerCase()}`) return true;
    } else if (e.type === 'text_mention' && e.user?.id === botUserId) {
      return true;
    }
  }
  return false;
}

/**
 * Pull both text (caption + body, falling back gracefully) and media refs out
 * of a raw Telegram message. The orchestrator downloads the refs to a temp
 * dir and hands them to the agent; the caller still sees a non-empty text
 * even for media-only messages so per-scope routing rules keep working.
 */
function extractMedia(m: RawMessage): { text: string; attachments: AttachmentRef[] } {
  const caption: string = m.caption ?? '';
  const body: string = m.text ?? caption;
  const attachments: AttachmentRef[] = [];

  if (m.photo?.length) {
    // Telegram delivers a tower of size variants; the largest is last. Use
    // it so the agent sees the best-quality version (Claude/Codex tolerate
    // multi-MB images; resizing here would lose detail unnecessarily).
    const largest = m.photo[m.photo.length - 1];
    attachments.push({ kind: 'image', file_id: largest.file_id, mimeType: 'image/jpeg' });
  }
  if (m.document?.mime_type?.startsWith('image/')) {
    attachments.push({
      kind: 'image',
      file_id: m.document.file_id,
      mimeType: m.document.mime_type,
      name: m.document.file_name,
    });
  }
  if (m.voice) {
    // Voice notes are OGG Opus when sent from the Telegram client.
    attachments.push({
      kind: 'audio',
      file_id: m.voice.file_id,
      mimeType: m.voice.mime_type ?? 'audio/ogg',
    });
  }
  if (m.audio) {
    attachments.push({
      kind: 'audio',
      file_id: m.audio.file_id,
      mimeType: m.audio.mime_type ?? 'audio/mpeg',
      name: m.audio.file_name,
    });
  }
  return { text: body, attachments };
}

/**
 * Resolve a Telegram `file_id` to bytes. Two-step: `getFile` returns a path
 * inside Telegram's file CDN, then we GET it through the bot's file root.
 * The returned URL is short-lived (~1h) and shouldn't be persisted.
 */
export async function downloadFile(fileId: string, timeoutMs = 30_000): Promise<Buffer> {
  const file = await tg<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error(`telegram getFile: no file_path for ${fileId}`);
  const url = `${API_BASE}/file/bot${token()}/${file.file_path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`telegram file download ${file.file_path}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- Outbound (REST) ------------------------------------------------

/**
 * Create a new forum topic in a supergroup. Returns the topic's
 * message_thread_id. Requires the bot to be an admin with the
 * `can_manage_topics` privilege.
 */
export async function createForumTopic(chatId: ChatId, name: string): Promise<number> {
  // Telegram caps topic names at 128 chars.
  const trimmedName = name.slice(0, 128) || 'metro';
  const r = await tg<{ message_thread_id: number }>('createForumTopic', {
    chat_id: chatId,
    name: trimmedName,
  });
  return r.message_thread_id;
}

export async function sendMessage(chatId: ChatId, threadId: number | undefined, text: string): Promise<number> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: mdToTelegramHtml(text),
    parse_mode: 'HTML',
  };
  if (threadId !== undefined) body.message_thread_id = threadId;
  try {
    const r = await tg<{ message_id: number }>('sendMessage', body);
    return r.message_id;
  } catch (err) {
    if (!isParseError(err)) throw err;
    // Bad HTML shouldn't block delivery — agents emit unusual markdown
    // shapes and a single malformed conversion isn't worth surfacing.
    log.warn({ err: errMsg(err) }, 'telegram HTML parse failed; sending plain');
    body.text = text;
    delete body.parse_mode;
    const r = await tg<{ message_id: number }>('sendMessage', body);
    return r.message_id;
  }
}

export async function editMessageText(chatId: ChatId, messageId: number, text: string): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: mdToTelegramHtml(text),
    parse_mode: 'HTML',
  };
  try {
    await tg('editMessageText', body);
  } catch (err) {
    // Telegram rejects edits that match the existing content — ignore that
    // specific case so debounced no-op flushes don't surface as errors.
    if (errMsg(err).includes('message is not modified')) return;
    if (!isParseError(err)) throw err;
    log.warn({ err: errMsg(err) }, 'telegram HTML parse failed; sending plain');
    body.text = text;
    delete body.parse_mode;
    try {
      await tg('editMessageText', body);
    } catch (err2) {
      if (errMsg(err2).includes('message is not modified')) return;
      throw err2;
    }
  }
}

function isParseError(err: unknown): boolean {
  return errMsg(err).toLowerCase().includes("can't parse entities");
}
