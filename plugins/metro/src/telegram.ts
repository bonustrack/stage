// Telegram Bot API wrapper + single-user polling loop. Activated only when
// TELEGRAM_BOT_TOKEN is set; otherwise the module loads silently and any call
// throws. server.ts checks the env var before importing handlers.

const API_BASE = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function fetchT(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30_000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}

export async function tg<T = any>(method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetchT(`${API_BASE}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? "unknown error"}`);
  return json.result as T;
}

export type ChatId = string | number;
export type UrlButton = { text: string; url: string };
export type SendOptions = {
  parseMode?: "HTML" | "MarkdownV2";
  disableLinkPreview?: boolean;
  buttons?: UrlButton[][];
};

// Compose a sendMessage / editMessageText body. Tool handlers add
// method-specific extras (reply_parameters, message_id) before calling tg().
export function buildSendBody(chatId: ChatId, text: string, opts: SendOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.disableLinkPreview) body.link_preview_options = { is_disabled: true };
  if (opts.buttons?.length) body.reply_markup = { inline_keyboard: opts.buttons };
  return body;
}

export async function getMe(): Promise<{ username: string }> {
  return tg("getMe", {});
}

// Resolve an inbound Telegram message to a single string. Image file_ids are
// cached so the agent can call `telegram-download-attachment` later with
// just the message_id. Voice/audio messages surface as `[voice]` / `[audio]`
// placeholders — Claude Code v2.1.133 can't ingest MCP audio content blocks,
// so the agent has no way to actually hear them.
async function messageToText(m: any, chatId: ChatId): Promise<string | null> {
  if (m.text) return m.text;

  const caption: string = m.caption ?? "";

  if (m.photo?.length) {
    const photo = m.photo[m.photo.length - 1];
    cacheAttachment(chatId, m.message_id, { file_id: photo.file_id, mime: "image/jpeg" });
    return [caption, "[image]"].filter(Boolean).join(" ");
  }
  if (m.document?.mime_type?.startsWith("image/")) {
    cacheAttachment(chatId, m.message_id, { file_id: m.document.file_id, mime: m.document.mime_type });
    return [caption, "[image]"].filter(Boolean).join(" ");
  }

  if (m.voice) return [caption, "[voice]"].filter(Boolean).join(" ");
  if (m.audio) return [caption, "[audio]"].filter(Boolean).join(" ");

  return caption || null;
}

async function downloadFile(fileId: string): Promise<Blob> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetchT(`${API_BASE}/file/bot${token()}/${file.file_path}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return res.blob();
}

// In-memory cache of inbound message → attachments. Lets `download_attachment`
// resolve a message_id back to the underlying file_id without re-polling.
// FIFO bound; the cache is per-process and dies on plugin restart.
type CachedAttachment = { file_id: string; mime: string };
const ATTACHMENT_CACHE_MAX = 200;
const attachmentCache = new Map<string, CachedAttachment[]>();

function cacheAttachment(chatId: ChatId, messageId: number, att: CachedAttachment): void {
  const key = `${chatId}:${messageId}`;
  const list = attachmentCache.get(key) ?? [];
  list.push(att);
  attachmentCache.set(key, list);
  if (attachmentCache.size > ATTACHMENT_CACHE_MAX) {
    const first = attachmentCache.keys().next().value;
    if (first !== undefined) attachmentCache.delete(first);
  }
}

export function getCachedAttachments(chatId: ChatId, messageId: number): CachedAttachment[] {
  return attachmentCache.get(`${chatId}:${messageId}`) ?? [];
}

export async function downloadAttachment(fileId: string, mime: string): Promise<{ data: string; mime: string }> {
  const blob = await downloadFile(fileId);
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return { data, mime: blob.type || mime };
}

// ----- polling -----
export type InboundMessage = { chat_id: ChatId; message_id: number; text: string };

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

export async function startPolling(): Promise<void> {
  // A registered webhook short-circuits getUpdates — clear it defensively so
  // the user doesn't have to know about that gotcha.
  await tg("deleteWebhook", { drop_pending_updates: false }).catch(() => {});

  let offset = 0;
  const initial = await tg<Array<{ update_id: number }>>("getUpdates", { timeout: 0 });
  if (initial.length) offset = initial[initial.length - 1].update_id + 1;

  while (true) {
    try {
      const updates = await tg<Array<any>>("getUpdates", { offset, timeout: 50 }, 60_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        void dispatchUpdate(u);
      }
    } catch (err: any) {
      console.error(`metro: telegram poll error: ${err?.message ?? err}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function dispatchUpdate(u: any): Promise<void> {
  const m = u.message;
  if (!m?.chat?.id || typeof m.message_id !== "number") return;
  try {
    const text = await messageToText(m, m.chat.id);
    if (text === null) return;
    onInboundHandler({ chat_id: m.chat.id, message_id: m.message_id, text });
  } catch (err: any) {
    onInboundHandler({
      chat_id: m.chat.id,
      message_id: m.message_id,
      text: `[message processing failed: ${err?.message ?? err}]`,
    });
  }
}
