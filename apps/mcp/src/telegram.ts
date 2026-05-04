// Low-level Telegram Bot API wrapper + multi-tenant polling loop.
//
// Multi-tenancy: a single bot serves many users. Each user starts a private
// chat with the bot via the OAuth flow (deep-link /start), and from then on
// is identified by their Telegram chat_id. Waiters are scoped per chat so
// concurrent ask() calls from different users don't interfere.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("metro-mcp: TELEGRAM_BOT_TOKEN env var is required");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Wraps fetch with an AbortController so a hung connection can't pin a
// waiter forever. Default timeout is 30 s; long-poll calls override.
async function fetchT(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30_000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
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

// ----- send message -----
export type UrlButton = { text: string; url: string };
export type CallbackButton = { text: string; callbackData: string };
export type InlineButton = UrlButton | CallbackButton;

export type SendOptions = {
  parseMode?: "HTML" | "MarkdownV2";
  disableLinkPreview?: boolean;
  buttons?: InlineButton[][];
};

function buildSendBody(chatId: ChatId, text: string, opts: SendOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.disableLinkPreview) body.link_preview_options = { is_disabled: true };
  if (opts.buttons?.length) {
    body.reply_markup = {
      inline_keyboard: opts.buttons.map(row =>
        row.map(b =>
          "url" in b
            ? { text: b.text, url: b.url }
            : { text: b.text, callback_data: b.callbackData },
        ),
      ),
    };
  }
  return body;
}

export type ChatId = string | number;

export async function sendMessage(chatId: ChatId, text: string, opts: SendOptions = {}): Promise<number> {
  const msg = await tg<{ message_id: number }>("sendMessage", buildSendBody(chatId, text, opts));
  return msg.message_id;
}

export async function getMe(): Promise<{ id: number; username: string; first_name: string }> {
  return tg("getMe", {});
}

// ----- file download / transcription -----
async function downloadTelegramFile(fileId: string): Promise<Blob> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetchT(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`, {
    timeoutMs: 30_000,
  });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  return res.blob();
}

async function transcribe(blob: Blob, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to transcribe voice messages");
  }
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", model);
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

// ----- content blocks -----
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

async function blobToBase64Block(blob: Blob, mimeType: string): Promise<ContentBlock> {
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return { type: "image", data, mimeType };
}

export type Notify = (text: string) => void;

// Resolve a Telegram message to MCP content blocks. Photos and image-typed
// documents pass through as image blocks. Voice/audio get transcribed via
// OpenAI to text. Captions become text blocks alongside images.
async function messageToContent(m: any, chatId: ChatId, notify: Notify): Promise<ContentBlock[] | null> {
  const blocks: ContentBlock[] = [];

  if (m.caption) blocks.push({ type: "text", text: m.caption });

  if (m.text) {
    return [{ type: "text", text: m.text }];
  }

  if (Array.isArray(m.photo) && m.photo.length > 0) {
    notify("downloading image…");
    const photo = m.photo[m.photo.length - 1];
    const blob = await downloadTelegramFile(photo.file_id);
    blocks.push(await blobToBase64Block(blob, "image/jpeg"));
    return blocks;
  }

  if (m.document?.mime_type?.startsWith("image/")) {
    notify("downloading image…");
    const blob = await downloadTelegramFile(m.document.file_id);
    blocks.push(await blobToBase64Block(blob, m.document.mime_type));
    return blocks;
  }

  if (m.voice) {
    notify("transcribing voice note…");
    const blob = await downloadTelegramFile(m.voice.file_id);
    const text = await transcribe(blob, "voice.ogg");
    await sendMessage(chatId, `📝 ${text}`);
    blocks.push({ type: "text", text });
    return blocks;
  }

  if (m.audio) {
    notify("transcribing audio…");
    const ext = (m.audio.mime_type ?? "audio/mpeg").split("/")[1] ?? "mp3";
    const blob = await downloadTelegramFile(m.audio.file_id);
    const text = await transcribe(blob, `audio.${ext}`);
    await sendMessage(chatId, `📝 ${text}`);
    blocks.push({ type: "text", text });
    return blocks;
  }

  return blocks.length ? blocks : null;
}

// ----- multi-tenant polling + waiters -----
type Waiter = { resolve: (content: ContentBlock[]) => void; notify: Notify };

// chatId → messageId → Waiter. Per-chat scoping prevents collisions when
// the same message_id appears in different chats.
const waiters = new Map<string, Map<number, Waiter>>();

function chatWaiters(chatId: ChatId): Map<number, Waiter> {
  const k = String(chatId);
  let m = waiters.get(k);
  if (!m) {
    m = new Map();
    waiters.set(k, m);
  }
  return m;
}

let pollingOffset = 0;
let pollingStarted = false;

// Hook for /start <param> messages — wired up by the OAuth module.
export type StartHandler = (m: any, param: string) => Promise<void>;
let startHandler: StartHandler | null = null;
export function onStart(handler: StartHandler): void {
  startHandler = handler;
}

export async function startPolling(): Promise<void> {
  if (pollingStarted) return;
  pollingStarted = true;

  const initial = await tg<Array<{ update_id: number }>>("getUpdates", { timeout: 0 });
  if (initial.length) pollingOffset = initial[initial.length - 1].update_id + 1;

  void (async () => {
    while (true) {
      try {
        const updates = await tg<Array<any>>(
          "getUpdates",
          { offset: pollingOffset, timeout: 50 },
          60_000,
        );
        for (const u of updates) {
          pollingOffset = u.update_id + 1;
          dispatchUpdate(u);
        }
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  })();
}

function dispatchUpdate(u: any): void {
  // Inline-keyboard tap → resolve waiter on the originating message.
  const cbq = u.callback_query;
  if (cbq) {
    void tg("answerCallbackQuery", { callback_query_id: cbq.id }).catch(() => {});
    const messageId: number | undefined = cbq.message?.message_id;
    const chatId = cbq.message?.chat?.id;
    if (messageId !== undefined && chatId !== undefined) {
      const cw = waiters.get(String(chatId));
      const w = cw?.get(messageId);
      if (w && cw) {
        cw.delete(messageId);
        w.resolve([{ type: "text", text: cbq.data ?? "" }]);
      }
    }
    return;
  }

  const m = u.message;
  if (!m) return;
  const chatId = m.chat?.id;
  if (chatId === undefined) return;

  // /start <param> → bot deep-link auth completion.
  if (typeof m.text === "string" && m.text.startsWith("/start ") && startHandler) {
    const param = m.text.slice("/start ".length).trim();
    if (param) {
      const handler = startHandler;
      void handler(m, param).catch(err => {
        console.error("metro-mcp: /start handler error:", err);
      });
      return;
    }
  }

  // Plain reply — route to the matching waiter on this chat.
  const cw = waiters.get(String(chatId));
  if (!cw || cw.size === 0) return;

  const replyTo: number | undefined = m.reply_to_message?.message_id;
  let waiterId: number | undefined;
  if (replyTo !== undefined && cw.has(replyTo)) {
    waiterId = replyTo;
  } else {
    waiterId = cw.keys().next().value;
  }
  if (waiterId === undefined) return;

  const id = waiterId;
  const waiter = cw.get(id)!;
  waiter.notify("reply received — processing…");
  void (async () => {
    let content: ContentBlock[];
    try {
      const c = await messageToContent(m, chatId, waiter.notify);
      if (c === null) return; // unsupported type — leave waiter pending
      content = c;
    } catch (err: any) {
      content = [{ type: "text", text: `[reply processing failed: ${err?.message ?? err}]` }];
    }
    const w = cw.get(id);
    if (w) {
      cw.delete(id);
      w.resolve(content);
    }
  })();
}

export async function ask(
  chatId: ChatId,
  question: string,
  opts: SendOptions,
  notify: Notify,
): Promise<ContentBlock[]> {
  await startPolling();
  const messageId = await sendMessage(chatId, question, opts);
  notify("message delivered to user — waiting for reply");
  return new Promise<ContentBlock[]>(resolve => {
    chatWaiters(chatId).set(messageId, { resolve, notify });
  });
}
