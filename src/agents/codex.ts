// Codex agent adapter. Spawns `codex app-server --listen unix://…` as a
// child process, talks to it over WebSocket-over-UDS, manages one codex
// thread per scope, and streams per-turn events back to the orchestrator
// (text deltas, tool-call lifecycle, completion).
//
// The orchestrator never speaks codex directly — it asks this adapter to
// `ensureThread(scopeKey)` and `sendTurn(threadId, text, callbacks)`.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { WebSocket, type RawData } from 'ws';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const SOCKET_PATH = join(STATE_DIR, 'codex-app-server.sock');
const READY_TIMEOUT_MS = 15_000;
const READY_POLL_MS = 100;

type Pending = { resolve: (r: unknown) => void; reject: (e: Error) => void };

export interface AgentTurnCallbacks {
  /** Streaming text delta from the agent's response. */
  onDelta(text: string): void;
  /** Tool call started; show a status line (e.g. "running: ls"). */
  onToolStart(kind: string, summary: string): void;
  /** Tool call ended; clear the status line if it matches. */
  onToolEnd(kind: string): void;
  /** Turn fully complete. */
  onComplete(): void;
  /** Transport / RPC error. */
  onError(err: Error): void;
}

type ThreadItem =
  | { type: 'agentMessage'; id: string; text: string }
  | { type: 'commandExecution'; id: string; command: string }
  | { type: 'fileChange'; id: string; changes: { path?: string }[] }
  | { type: 'reasoning'; id: string }
  | { type: string; id: string }; // catch-all

export class CodexAgent {
  private ws: WebSocket | null = null;
  private daemon: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private turnCallbacks = new Map<string, AgentTurnCallbacks>(); // keyed by thread_id

  constructor(private clientVersion: string) {}

  async start(): Promise<void> {
    log.info({ socket: SOCKET_PATH }, 'codex agent: starting app-server');
    // Spawn the daemon listening on our UDS. Inherits CODEX_HOME so it picks
    // up the user's auth, settings, MCPs, etc.
    this.daemon = spawn('codex', ['app-server', '--listen', `unix://${SOCKET_PATH}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Codex's own tracing goes to stderr (incl. its own ERROR-level lines for
    // MCP config issues etc). It's not metro's signal — keep it at trace so
    // `metro doctor` / debug log views aren't drowned in unrelated noise.
    this.daemon.stdout?.on('data', d => log.trace({ src: 'codex-stdout' }, String(d).trim()));
    this.daemon.stderr?.on('data', d => log.trace({ src: 'codex-stderr' }, String(d).trim()));
    this.daemon.on('exit', code => log.warn({ code }, 'codex daemon exited'));

    await this.waitForSocket();
    await this.connect();
    log.info('codex agent: ready');
  }

  async stop(): Promise<void> {
    this.ws?.close();
    this.ws = null;
    this.daemon?.kill('SIGTERM');
    this.daemon = null;
  }

  /**
   * Create a new codex thread and return its id. The caller is responsible
   * for caching the mapping `scopeKey → threadId` and only calling this
   * once per scope (subsequent inbounds reuse the thread via `sendTurn`).
   */
  async createThread(): Promise<string> {
    const result = await this.call<{ thread: { id: string } }>('thread/start', {});
    log.info({ thread: result.thread.id }, 'codex agent: thread created');
    return result.thread.id;
  }

  /**
   * Send a user message to a thread and stream the agent's response via
   * the provided callbacks. Resolves immediately after `turn/start`
   * acknowledges; callbacks fire as notifications arrive and conclude
   * with `onComplete` or `onError`.
   */
  async sendTurn(threadId: string, text: string, callbacks: AgentTurnCallbacks): Promise<void> {
    this.turnCallbacks.set(threadId, callbacks);
    try {
      await this.call('turn/start', {
        threadId,
        input: [{ type: 'text', text, textElements: [] }],
      });
    } catch (err) {
      this.turnCallbacks.delete(threadId);
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // --- transport ---

  private async waitForSocket(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (existsSync(SOCKET_PATH)) return;
      await new Promise(r => setTimeout(r, READY_POLL_MS));
    }
    throw new Error(`codex app-server didn't appear at ${SOCKET_PATH} within ${READY_TIMEOUT_MS}ms`);
  }

  private async connect(): Promise<void> {
    // perMessageDeflate disabled: codex 0.130's WS upgrade handler closes
    // the connection if a client offers `Sec-WebSocket-Extensions:
    // permessage-deflate` (the `ws` library's default). Disabling it makes
    // the upgrade succeed cleanly. Compression is irrelevant over a UDS.
    const ws = new WebSocket('ws://localhost/', {
      perMessageDeflate: false,
      createConnection: () => {
        const sock = createConnection({ path: SOCKET_PATH });
        // Swallow socket-level errors so a transport hiccup during the HTTP
        // upgrade doesn't surface as an uncaught error on the http_client
        // request (Node's http.ClientRequest re-emits this).
        sock.on('error', err => log.warn({ err: errMsg(err) }, 'codex agent: socket error'));
        return sock;
      },
    });
    this.ws = ws;
    ws.on('error', err => log.warn({ err: errMsg(err) }, 'codex agent: websocket error'));
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', err => reject(err));
    });
    ws.on('message', data => this.onMessage(data));
    ws.on('close', () => {
      log.warn('codex agent: websocket closed');
      this.ws = null;
    });
    await this.call('initialize', {
      clientInfo: { name: 'metro', version: this.clientVersion, title: null },
    });
  }

  private onMessage(raw: RawData): void {
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'codex agent: malformed message');
      return;
    }

    // RPC response
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? 'rpc error'));
      else p.resolve(msg.result);
      return;
    }

    // Notifications: route to the matching thread's callbacks
    if (!msg.method) return;
    const params = msg.params as { threadId?: string } | undefined;
    const threadId = params?.threadId;
    if (!threadId) return;
    const cb = this.turnCallbacks.get(threadId);
    if (!cb) return; // no active turn for this thread (yet or anymore)

    if (msg.method === 'item/agentMessage/delta') {
      const p = msg.params as { delta: string };
      cb.onDelta(p.delta);
    } else if (msg.method === 'item/started') {
      const p = msg.params as { item: ThreadItem };
      const summary = summarizeItem(p.item);
      if (summary && p.item.type !== 'agentMessage') {
        cb.onToolStart(p.item.type, summary);
      }
    } else if (msg.method === 'item/completed') {
      const p = msg.params as { item: ThreadItem };
      if (p.item.type !== 'agentMessage') cb.onToolEnd(p.item.type);
    } else if (msg.method === 'turn/completed') {
      this.turnCallbacks.delete(threadId);
      cb.onComplete();
    }
  }

  private call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.ws) return Promise.reject(new Error('codex agent: not connected'));
    const id = this.nextId++;
    const ws = this.ws;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
}

function summarizeItem(item: ThreadItem): string {
  if (item.type === 'commandExecution' && 'command' in item) {
    return `running: ${truncate(item.command ?? '', 60)}`;
  }
  if (item.type === 'fileChange' && 'changes' in item) {
    const n = item.changes?.length ?? 0;
    return n > 0 ? `editing ${n} file${n === 1 ? '' : 's'}` : 'editing files';
  }
  if (item.type === 'reasoning') return 'thinking…';
  if (item.type === 'agentMessage') return ''; // text deltas handled separately
  return item.type;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
