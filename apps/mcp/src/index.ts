#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

// Load .env from the package root (next to package.json) so the server works
// regardless of the cwd it was spawned with. Real env vars take precedence.
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
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("metro-mcp: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars are required");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg<T = any>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? "unknown error"}`);
  return json.result as T;
}

async function sendMessage(text: string): Promise<number> {
  const msg = await tg<{ message_id: number }>("sendMessage", {
    chat_id: CHAT_ID,
    text,
  });
  return msg.message_id;
}

async function downloadTelegramFile(fileId: string): Promise<Blob> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
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
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

async function blobToBase64Block(blob: Blob, mimeType: string): Promise<ContentBlock> {
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return { type: "image", data, mimeType };
}

// Resolve a Telegram message to MCP content blocks. Photos and image-typed
// documents pass through as image blocks (Claude reads them natively). Voice
// and audio get transcribed via OpenAI to text. Captions become text blocks
// alongside images. Returns `null` for unsupported message types.
async function messageToContent(m: any): Promise<ContentBlock[] | null> {
  const blocks: ContentBlock[] = [];

  if (m.caption) blocks.push({ type: "text", text: m.caption });

  if (m.text) {
    return [{ type: "text", text: m.text }];
  }

  if (Array.isArray(m.photo) && m.photo.length > 0) {
    // Telegram returns multiple sizes; the last entry is the largest.
    const photo = m.photo[m.photo.length - 1];
    const blob = await downloadTelegramFile(photo.file_id);
    blocks.push(await blobToBase64Block(blob, "image/jpeg"));
    return blocks;
  }

  if (m.document?.mime_type?.startsWith("image/")) {
    const blob = await downloadTelegramFile(m.document.file_id);
    blocks.push(await blobToBase64Block(blob, m.document.mime_type));
    return blocks;
  }

  if (m.voice) {
    const blob = await downloadTelegramFile(m.voice.file_id);
    const text = await transcribe(blob, "voice.ogg");
    await sendMessage(`📝 ${text}`);
    blocks.push({ type: "text", text });
    return blocks;
  }

  if (m.audio) {
    const ext = (m.audio.mime_type ?? "audio/mpeg").split("/")[1] ?? "mp3";
    const blob = await downloadTelegramFile(m.audio.file_id);
    const text = await transcribe(blob, `audio.${ext}`);
    await sendMessage(`📝 ${text}`);
    blocks.push({ type: "text", text });
    return blocks;
  }

  return blocks.length ? blocks : null;
}

// Telegram only allows one consumer of getUpdates at a time, so all Ask calls
// share a single polling loop and matching is done by reply_to_message_id.
let pollingOffset = 0;
let pollingStarted = false;
const waiters = new Map<number, (content: ContentBlock[]) => void>();

async function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;

  // Drain any pending updates so we start from "now".
  const initial = await tg<Array<{ update_id: number }>>("getUpdates", { timeout: 0 });
  if (initial.length) pollingOffset = initial[initial.length - 1].update_id + 1;

  // Long-poll forever.
  void (async () => {
    while (true) {
      try {
        const updates = await tg<Array<any>>("getUpdates", {
          offset: pollingOffset,
          timeout: 50,
        });
        for (const u of updates) {
          pollingOffset = u.update_id + 1;
          const m = u.message;
          if (!m || String(m.chat?.id) !== String(CHAT_ID)) continue;

          // Prefer matching the reply_to id; fall back to delivering to the
          // oldest waiter so plain (non-reply) Telegram messages still resolve.
          const replyTo: number | undefined = m.reply_to_message?.message_id;
          let waiterId: number | undefined;
          if (replyTo !== undefined && waiters.has(replyTo)) {
            waiterId = replyTo;
          } else if (waiters.size > 0) {
            waiterId = waiters.keys().next().value;
          }
          if (waiterId === undefined) continue;

          // Resolve text/voice/audio/image asynchronously so download +
          // transcription don't block the polling loop.
          const id = waiterId;
          void (async () => {
            let content: ContentBlock[];
            try {
              const c = await messageToContent(m);
              if (c === null) return; // unsupported type — leave waiter pending
              content = c;
            } catch (err: any) {
              content = [{ type: "text", text: `[reply processing failed: ${err?.message ?? err}]` }];
            }
            const cb = waiters.get(id);
            if (cb) {
              waiters.delete(id);
              cb(content);
            }
          })();
        }
      } catch (err) {
        // Network blip — back off briefly and keep going.
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  })();
}

async function ask(question: string): Promise<ContentBlock[]> {
  await startPolling();
  const messageId = await sendMessage(question);
  return new Promise<ContentBlock[]>(resolve => waiters.set(messageId, resolve));
}

const server = new McpServer({
  name: "@metro-labs/mcp",
  version: "0.1.0",
});

server.registerTool(
  "metro-notify",
  {
    description: "Send a one-way message to the user via Telegram (no reply expected).",
    inputSchema: { message: z.string().describe("Plain text to send to the user.") },
  },
  async ({ message }) => {
    await sendMessage(message);
    return { content: [{ type: "text", text: "sent" }] };
  },
);

server.registerTool(
  "metro-ask",
  {
    description: "Send a question to the user via Telegram and wait for their reply. The reply may be text, a transcribed voice note, or an image (with optional caption). Returns the user's reply as MCP content blocks.",
    inputSchema: { question: z.string().describe("The question to ask the user.") },
  },
  async ({ question }) => {
    const content = await ask(question);
    return { content };
  },
);

// ----- transport selection -----
// If PORT (or MCP_HTTP_PORT) is set, expose the server over Streamable HTTP
// at /mcp so it can be used as a remote MCP from claude.ai / chatgpt.com.
// Otherwise fall back to stdio for local Claude Desktop spawning.
const HTTP_PORT = process.env.MCP_HTTP_PORT || process.env.PORT;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (HTTP_PORT) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
  const withCors = (res: Response) => {
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    return res;
  };

  Bun.serve({
    port: Number(HTTP_PORT),
    async fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      const url = new URL(req.url);
      if (url.pathname === "/health") {
        return withCors(new Response("ok"));
      }
      if (url.pathname !== "/mcp") {
        return withCors(new Response("not found", { status: 404 }));
      }
      if (AUTH_TOKEN) {
        const got = req.headers.get("authorization");
        if (got !== `Bearer ${AUTH_TOKEN}`) {
          return withCors(new Response("unauthorized", { status: 401 }));
        }
      }
      return withCors(await transport.handleRequest(req));
    },
  });
  console.error(
    `metro-mcp: HTTP transport listening on :${HTTP_PORT}` +
    (AUTH_TOKEN ? " (bearer-token protected)" : " (open — no MCP_AUTH_TOKEN set)"),
  );
} else {
  await server.connect(new StdioServerTransport());
}
