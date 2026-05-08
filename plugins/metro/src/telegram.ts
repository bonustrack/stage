// Telegram Bot API wrapper + single-user polling loop.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("metro: TELEGRAM_BOT_TOKEN env var is required");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function fetchT(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30_000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}

export async function tg<T = any>(method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetchT(`${API}/${method}`, {
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
  if (opts.buttons?.length) {
    body.reply_markup = { inline_keyboard: opts.buttons };
  }
  return body;
}

export async function sendMessage(chatId: ChatId, text: string, opts: SendOptions = {}): Promise<number> {
  const msg = await tg<{ message_id: number }>("sendMessage", buildSendBody(chatId, text, opts));
  return msg.message_id;
}

export async function getMe(): Promise<{ username: string }> {
  return tg("getMe", {});
}

// Resolve an inbound Telegram message to a single string. Voice/audio gets
// transcribed via OpenAI; images become a `[image]` placeholder (channel
// notifications carry strings, not blobs). Returns null for unsupported
// types so the caller can drop the update.
async function messageToText(m: any, chatId: ChatId): Promise<string | null> {
  if (m.text) return m.text;

  const caption: string = m.caption ?? "";

  if (m.photo?.length || m.document?.mime_type?.startsWith("image/")) {
    return [caption, "[image]"].filter(Boolean).join(" ");
  }

  const audio = m.voice ?? m.audio;
  if (audio) {
    const blob = await downloadFile(audio.file_id);
    const ext = (audio.mime_type ?? "audio/ogg").split("/")[1] ?? "ogg";
    const text = await transcribe(blob, `audio.${ext}`);
    await sendMessage(chatId, `📝 ${text}`);
    return [caption, text].filter(Boolean).join(" ");
  }

  return caption || null;
}

async function downloadFile(fileId: string): Promise<Blob> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetchT(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return res.blob();
}

async function transcribe(blob: Blob, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required for voice/audio transcription");
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  const res = await fetchT("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    timeoutMs: 60_000,
  });
  if (!res.ok) throw new Error(`whisper: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}

// ----- polling -----
export type InboundMessage = { chat_id: ChatId; message_id: number; text: string };

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

export async function startPolling(): Promise<void> {
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
      console.error(`metro: poll error: ${err?.message ?? err}`);
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
