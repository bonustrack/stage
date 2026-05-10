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
type Photo = { file_id: string };
type FileWithMime = { file_id: string; mime_type?: string };
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

  const text = await messageToText(m);
  if (!text) {
    log.trace({ chat: m.chat.id }, 'telegram: no text/caption');
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

async function messageToText(m: RawMessage): Promise<string | null> {
  if (m.text) return m.text;
  const caption: string = m.caption ?? '';
  if (m.photo?.length) return [caption, '[image]'].filter(Boolean).join(' ');
  if (m.document?.mime_type?.startsWith('image/')) return [caption, '[image]'].filter(Boolean).join(' ');
  if (m.voice) return [caption, '[voice]'].filter(Boolean).join(' ');
  if (m.audio) return [caption, '[audio]'].filter(Boolean).join(' ');
  return caption || null;
}

// ---------- Outbound (REST) ------------------------------------------------

export async function sendMessage(chatId: ChatId, threadId: number | undefined, text: string): Promise<number> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (threadId !== undefined) body.message_thread_id = threadId;
  const r = await tg<{ message_id: number }>('sendMessage', body);
  return r.message_id;
}

export async function editMessageText(chatId: ChatId, messageId: number, text: string): Promise<void> {
  try {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text });
  } catch (err) {
    // Telegram rejects edits that match the existing content — ignore that
    // specific case so debounced no-op flushes don't surface as errors.
    if (errMsg(err).includes('message is not modified')) return;
    throw err;
  }
}
