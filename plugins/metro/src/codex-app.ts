// Codex app-server delivery: WebSocket JSON-RPC client + queue/retry wrapper.
// Used only when METRO_RUNTIME=codex. Claude Code reads MCP notifications
// directly off the stdio pipe — Codex doesn't, so for Codex we open a
// parallel WebSocket to its app-server and inject inbound messages as new
// turns via `turn/start`.

import pkg from "../package.json" with { type: "json" };
import { log } from "./log.js";

type JsonRpcId = number;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type JsonRpcResponse = { id?: unknown; result?: unknown; error?: unknown };

export type CodexInboundMessage =
  | { platform: "telegram"; chatId: string; messageId: string; text: string }
  | { platform: "discord"; channelId: string; messageId: string; text: string };

export function formatChannelMessage(message: CodexInboundMessage): string {
  const attrs =
    message.platform === "telegram"
      ? `platform="telegram" chat_id="${escapeAttr(message.chatId)}" message_id="${escapeAttr(message.messageId)}"`
      : `platform="discord" channel_id="${escapeAttr(message.channelId)}" message_id="${escapeAttr(message.messageId)}"`;

  return `<channel ${attrs}>\n${escapeText(message.text)}\n</channel>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// Public emit signature — same shape as the Claude Code path so server.ts can
// pick a `deliver` function at runtime and not branch per-message.
export type CodexEmit = (message: CodexInboundMessage) => void;

// Returns an emit function that serializes inbound messages through a queue
// and retries delivery against the Codex app-server. The first call to emit
// triggers the lazy connection.
export function startCodexDelivery(): CodexEmit {
  let queue: Promise<unknown> = Promise.resolve();
  return function emit(message: CodexInboundMessage): void {
    queue = queue
      .then(() => deliverWithRetry(message))
      .catch(err => log.error({ err: err?.message ?? err }, "codex delivery failed"));
  };
}

async function deliverWithRetry(message: CodexInboundMessage): Promise<void> {
  const text = formatChannelMessage(message);
  const attempts = Number(process.env.METRO_CODEX_DELIVERY_ATTEMPTS ?? 90);
  const delayMs = Number(process.env.METRO_CODEX_DELIVERY_RETRY_MS ?? 2_000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await deliverOnce(text);
      log.info({ platform: message.platform, messageId: message.messageId }, "delivered to codex");
      return;
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      log.warn(
        { err: err instanceof Error ? err.message : String(err), attempt, attempts },
        "codex delivery failed; retrying",
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function deliverOnce(text: string): Promise<void> {
  const client = new CodexAppServerClient();
  try {
    await client.connect();
    const threadId = await client.resolveThreadId();
    await client.startTurn(threadId, text);
  } finally {
    client.close();
  }
}

class CodexAppServerClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();

  async connect(): Promise<void> {
    const url = process.env.METRO_CODEX_APP_SERVER_URL;
    if (!url) {
      throw new Error(
        "METRO_CODEX_APP_SERVER_URL is required — start `codex app-server --listen ws://…` and point Metro at it",
      );
    }

    const ws = new WebSocket(url);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`codex app-server websocket timed out: ${url}`)), 10_000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`codex app-server websocket failed: ${url}`));
      });
    });

    ws.addEventListener("message", event => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      for (const line of data.split("\n")) {
        if (line.trim()) this.handleLine(line);
      }
    });
    ws.addEventListener("close", () => this.rejectAll(new Error("codex app-server websocket closed")));
    ws.addEventListener("error", () => this.rejectAll(new Error("codex app-server websocket error")));

    await this.request("initialize", {
      clientInfo: { name: "metro", title: "Metro", version: pkg.version },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized");
  }

  async resolveThreadId(): Promise<string> {
    const configured = process.env.METRO_CODEX_THREAD_ID;
    if (configured) return configured;

    const loaded = await this.request("thread/loaded/list", { limit: 10 });
    const loadedData = objectValue(loaded, "data");
    const ids = Array.isArray(loadedData) ? loadedData.filter((id: unknown) => typeof id === "string") : [];
    if (ids.length === 1) return ids[0];
    if (ids.length > 1) {
      log.warn({ threadIds: ids }, "multiple loaded Codex threads; using the first one");
      return ids[0];
    }

    if (process.env.METRO_CODEX_AUTO_START_THREAD === "1") {
      const started = await this.request("thread/start", {
        cwd: process.env.METRO_CODEX_CWD ?? process.cwd(),
        experimentalRawEvents: false,
        persistExtendedHistory: true,
      });
      const id = objectValue(objectValue(started, "thread"), "id");
      if (typeof id === "string") return id;
    }

    throw new Error(
      "no loaded Codex thread found; open a Codex session, set METRO_CODEX_THREAD_ID, or set METRO_CODEX_AUTO_START_THREAD=1",
    );
  }

  async startTurn(threadId: string, text: string): Promise<void> {
    // `responsesapiClientMetadata` is intentionally lowercase `api` — that's
    // how Codex's app-server protocol names the field. See:
    // codex-rs/app-server-protocol/src/protocol/v2/turn.rs
    await this.request("turn/start", {
      threadId,
      input: [{ type: "text", text, text_elements: [] }],
      responsesapiClientMetadata: { source: "metro" },
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private request(method: string, params?: unknown, timeoutMs = Number(process.env.METRO_CODEX_TIMEOUT_MS ?? 30_000)) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send(payload);
    });
  }

  private notify(method: string, params?: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private send(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("codex app-server websocket is not connected");
    }
    this.ws.send(`${JSON.stringify(payload)}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(line) as JsonRpcResponse;
    } catch {
      log.debug({ line }, "ignoring non-json codex app-server line");
      return;
    }

    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`codex app-server ${message.id}: ${JSON.stringify(message.error)}`));
    } else {
      pending.resolve(message.result);
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

function objectValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[key];
}
