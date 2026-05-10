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
import type { Agent, AgentTurnCallbacks } from './types.js';

export type { AgentTurnCallbacks };

const SOCKET_PATH = join(STATE_DIR, 'codex-app-server.sock');
const READY_TIMEOUT_MS = 15_000;
const READY_POLL_MS = 100;

type Pending = { resolve: (r: unknown) => void; reject: (e: Error) => void };

type ThreadItem =
  | { type: 'agentMessage'; id: string; text: string }
  | { type: 'commandExecution'; id: string; command: string }
  | { type: 'fileChange'; id: string; changes: { path?: string }[] }
  | { type: 'reasoning'; id: string }
  | { type: string; id: string }; // catch-all

export class CodexAgent implements Agent {
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
      // Wire format per codex's generated TS bindings: `text_elements`
      // (snake_case), not camelCase. Sending camelCase silently degrades
      // — accepted by the server but doesn't echo back in items.
      await this.call('turn/start', {
        threadId,
        input: [{ type: 'text', text, text_elements: [] }],
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
      // Drain stranded turns + RPC promises so the orchestrator can
      // release its in-flight gate and the user sees an error rather
      // than a permanent "Thinking…".
      this.drainPending('codex websocket closed');
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

    // Notifications.
    if (!msg.method) return;
    log.trace({ method: msg.method }, 'codex agent: notification');
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
      if (summary && p.item.type !== 'agentMessage' && p.item.type !== 'userMessage') {
        cb.onToolStart(p.item.type, summary);
      }
    } else if (msg.method === 'item/completed') {
      const p = msg.params as { item: ThreadItem };
      if (p.item.type !== 'agentMessage' && p.item.type !== 'userMessage') cb.onToolEnd(p.item.type);
    } else if (msg.method === 'thread/status/changed') {
      // Codex 0.130 doesn't reliably emit `turn/completed` — `thread/status`
      // returning to `idle` is the dependable completion signal. The same
      // notification fires on `active` when a turn starts; ignore those.
      const p = msg.params as { status: { type: string } };
      if (p.status?.type === 'idle') {
        this.turnCallbacks.delete(threadId);
        cb.onComplete();
      } else if (p.status?.type === 'systemError') {
        this.turnCallbacks.delete(threadId);
        cb.onError(new Error('codex thread entered systemError'));
      }
    } else if (msg.method === 'turn/completed') {
      // Belt-and-braces: if codex does emit it, take it.
      this.turnCallbacks.delete(threadId);
      cb.onComplete();
    } else if (msg.method === 'error') {
      const p = msg.params as { error?: { message?: string } };
      this.turnCallbacks.delete(threadId);
      cb.onError(new Error(p.error?.message ?? 'codex error notification'));
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

  /** Fail every in-flight turn + RPC. Used when the transport dies. */
  private drainPending(reason: string): void {
    const err = new Error(reason);
    for (const cb of this.turnCallbacks.values()) {
      try { cb.onError(err); } catch (e) { log.warn({ err: errMsg(e) }, 'codex agent: drain callback threw'); }
    }
    this.turnCallbacks.clear();
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

function summarizeItem(item: ThreadItem): string {
  if (item.type === 'commandExecution' && 'command' in item) {
    return `Running: ${truncate(item.command ?? '', 60)}`;
  }
  if (item.type === 'fileChange' && 'changes' in item) {
    const n = item.changes?.length ?? 0;
    return n > 0 ? `Editing ${n} file${n === 1 ? '' : 's'}` : 'Editing files';
  }
  if (item.type === 'reasoning') return 'Thinking…';
  if (item.type === 'agentMessage') return ''; // text deltas handled separately
  return item.type;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
