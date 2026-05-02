#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

// ----- env loader (next to package.json) -----
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT = process.env.TELEGRAM_CHAT_ID; // optional; if set, restrict
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
const SYSTEM = process.env.SYSTEM_PROMPT ||
  "You are a friendly assistant chatting with the user via Telegram. " +
  "Keep replies under 4000 characters. Plain text — Telegram doesn't render markdown by default.";

if (!BOT_TOKEN || !ANTHROPIC_KEY) {
  console.error("metro-bot: TELEGRAM_BOT_TOKEN and ANTHROPIC_API_KEY are required");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg<T = any>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? "unknown"}`);
  return json.result as T;
}

// ----- conversation history (in-memory, per-chat) -----
type Msg = { role: "user" | "assistant"; content: string };
const histories = new Map<string, Msg[]>();
const MAX_HISTORY = 40;

function pushHistory(chatId: string, msg: Msg) {
  const h = histories.get(chatId) ?? [];
  h.push(msg);
  if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
  histories.set(chatId, h);
}

// ----- voice transcription (optional) -----
async function downloadFile(fileId: string): Promise<Blob> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return res.blob();
}

async function transcribe(blob: Blob, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required for voice messages");
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", model);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper: ${await res.text()}`);
  return ((await res.json()) as { text: string }).text;
}

async function messageToText(m: any): Promise<string | null> {
  if (m.text) return m.text;
  if (m.voice) {
    const text = await transcribe(await downloadFile(m.voice.file_id), "voice.ogg");
    await tg("sendMessage", { chat_id: m.chat.id, text: `📝 ${text}`, reply_to_message_id: m.message_id });
    return text;
  }
  if (m.audio) {
    const ext = (m.audio.mime_type ?? "audio/mpeg").split("/")[1] ?? "mp3";
    const text = await transcribe(await downloadFile(m.audio.file_id), `audio.${ext}`);
    await tg("sendMessage", { chat_id: m.chat.id, text: `📝 ${text}`, reply_to_message_id: m.message_id });
    return text;
  }
  return null;
}

// ----- streaming reply -----
const TELEGRAM_MAX_LEN = 4000; // a bit under 4096 for safety
const EDIT_INTERVAL_MS = 800;  // throttle edits to stay under Telegram rate limits

async function streamReply(chatId: string | number, userText: string) {
  const chatKey = String(chatId);
  pushHistory(chatKey, { role: "user", content: userText });

  // Send placeholder
  const placeholder = await tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: "…",
  });
  let messageId = placeholder.message_id;

  let buffer = "";
  let lastEdit = 0;
  let lastShown = "";
  let chunkIndex = 0;

  const editCurrent = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastEdit < EDIT_INTERVAL_MS) return;
    if (buffer === lastShown && !force) return;

    // If buffer outgrew the Telegram limit, freeze the current message and
    // start a new one for the overflow.
    if (buffer.length > TELEGRAM_MAX_LEN) {
      const fitText = buffer.slice(0, TELEGRAM_MAX_LEN);
      try {
        await tg("editMessageText", { chat_id: chatId, message_id: messageId, text: fitText });
      } catch (err: any) {
        if (!String(err.message ?? "").includes("not modified")) console.error("edit failed:", err.message);
      }
      const next = await tg<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: "…",
      });
      messageId = next.message_id;
      buffer = buffer.slice(TELEGRAM_MAX_LEN);
      lastShown = "";
      chunkIndex++;
    }

    lastEdit = now;
    lastShown = buffer;
    const display = buffer || "…";
    try {
      await tg("editMessageText", { chat_id: chatId, message_id: messageId, text: display });
    } catch (err: any) {
      if (!String(err.message ?? "").includes("not modified")) {
        console.error("edit failed:", err.message);
      }
    }
  };

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: histories.get(chatKey)!.map(h => ({ role: h.role, content: h.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        buffer += event.delta.text;
        await editCurrent();
      }
    }
    await editCurrent(true);

    // Reconstruct full assistant text for history (sum of split chunks).
    const final = await stream.finalMessage();
    const fullText = final.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map(c => c.text)
      .join("");
    pushHistory(chatKey, { role: "assistant", content: fullText });
    void chunkIndex; // (kept for potential future telemetry)
  } catch (err: any) {
    buffer = `⚠️ ${err?.message ?? err}`;
    await editCurrent(true);
  }
}

// ----- polling -----
let pollingOffset = 0;

async function poll() {
  // Drain any backlog so we start from "now".
  const initial = await tg<Array<{ update_id: number }>>("getUpdates", { timeout: 0 });
  if (initial.length) pollingOffset = initial[initial.length - 1].update_id + 1;
  console.error(`metro-bot: ready · model=${MODEL}${ALLOWED_CHAT ? ` · chat=${ALLOWED_CHAT}` : ""}`);

  let activeTurn: Promise<void> = Promise.resolve();

  while (true) {
    try {
      const updates = await tg<Array<any>>("getUpdates", { offset: pollingOffset, timeout: 50 });
      for (const u of updates) {
        pollingOffset = u.update_id + 1;
        const m = u.message;
        if (!m || !m.chat?.id) continue;
        if (ALLOWED_CHAT && String(m.chat.id) !== String(ALLOWED_CHAT)) continue;

        // Serialize turns per process so streams don't interleave Telegram
        // edits. (Per-chat would be better; this is fine for single-user.)
        activeTurn = activeTurn.then(async () => {
          try {
            const text = await messageToText(m);
            if (!text) {
              await tg("sendMessage", {
                chat_id: m.chat.id,
                text: "I can read text and voice notes. (Send a voice note and I'll transcribe + answer.)",
                reply_to_message_id: m.message_id,
              });
              return;
            }
            await streamReply(m.chat.id, text);
          } catch (err: any) {
            console.error("turn error:", err);
            try {
              await tg("sendMessage", {
                chat_id: m.chat.id,
                text: `⚠️ ${err?.message ?? err}`,
              });
            } catch {}
          }
        });
      }
    } catch (err) {
      console.error("poll error:", err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

await poll();
