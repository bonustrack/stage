// JSON-RPC over WebSocket client for the Codex app-server. By default
// connects over the Unix domain socket exposed by `codex remote-control`
// (see paths.DEFAULT_CODEX_SOCKET). On every metro inbound it calls
// `turn/start`, which lands the JSON line in the agent's history as a
// user message and wakes the agent — the Codex equivalent of Claude
// Code's `Monitor`.
//
// Wire format: standard JSON-RPC 2.0 over WebSocket. Methods we use:
//   - initialize      → handshake, declares clientInfo.
//   - thread/list     → discover existing threads on connect.
//   - thread/started  → notification; track new threads as they appear.
//   - turn/started    → notification; mark a turn in flight.
//   - turn/completed  → notification; drain queued inbounds.
//   - turn/start      → push a user message and wake the agent.
//
// If no thread exists yet, inbounds queue in memory; they fire as soon
// as a thread is started or learned. If the connection drops, reconnect
// with linear backoff and replay the queue. Connection failures don't
// break metro — stdout emit always runs first, so Claude Code Monitor
// users keep working regardless.

import { createConnection } from 'node:net';
import { WebSocket, type RawData } from 'ws';
import { errMsg, log } from '../log.js';

type Pending = { resolve: (result: unknown) => void; reject: (err: Error) => void };
type Inbound = string;

const RECONNECT_DELAY_MS = 2_000;
const MAX_QUEUE = 100;
// Backstop: if `turn/completed` never arrives (the daemon doesn't broadcast
// it to all clients, or we miss it for any reason), unstick after this long.
// Generous enough that any normal turn finishes well within it.
const TURN_TIMEOUT_MS = 120_000;

type Endpoint = { kind: 'tcp'; url: string } | { kind: 'unix'; path: string };

/**
 * Accept any of these forms for METRO_CODEX_RC:
 *   ws://host:port/    TCP WebSocket.
 *   wss://host/        TCP WebSocket over TLS.
 *   unix:///abs/path   UDS WebSocket (the default for `codex remote-control`).
 *   /abs/path          shorthand for unix:///abs/path.
 */
export function parseCodexUrl(input: string): Endpoint {
  if (input.startsWith('ws://') || input.startsWith('wss://')) {
    return { kind: 'tcp', url: input };
  }
  if (input.startsWith('unix://')) {
    return { kind: 'unix', path: input.replace(/^unix:\/+/, '/') };
  }
  if (input.startsWith('/')) {
    return { kind: 'unix', path: input };
  }
  throw new Error(`unsupported METRO_CODEX_RC: ${input} (expected ws://…, wss://…, unix://…, or absolute path)`);
}

function openSocket(endpoint: Endpoint): WebSocket {
  if (endpoint.kind === 'tcp') return new WebSocket(endpoint.url);
  // UDS WebSocket: ws library upgrades any duplex stream, so we feed it a
  // unix-socket Net connection via `createConnection`. The `ws://localhost/`
  // URL is a placeholder — only the framing matters at this point; the
  // bytes flow over the UDS we just opened.
  return new WebSocket('ws://localhost/', {
    createConnection: () => createConnection({ path: endpoint.path }),
  });
}

export class CodexRC {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private threadId: string | null = null;
  private queue: Inbound[] = [];
  private connected = false;
  private connecting = false;
  private turnInFlight = false;
  private turnTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private endpoint: Endpoint;
  private displayUrl: string;

  constructor(url: string, private clientVersion: string) {
    this.endpoint = parseCodexUrl(url);
    this.displayUrl = url;
  }

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Push an inbound JSON line to the Codex agent. If not yet connected or
   * no thread is active, queues until ready (FIFO, capped).
   */
  push(line: Inbound): void {
    if (this.queue.length >= MAX_QUEUE) {
      log.warn({ url: this.displayUrl }, 'codex-rc queue full, dropping oldest inbound');
      this.queue.shift();
    }
    this.queue.push(line);
    void this.drainQueue();
  }

  private async connect(): Promise<void> {
    if (this.closed || this.connected || this.connecting) return;
    this.connecting = true;
    try {
      const ws = openSocket(this.endpoint);
      this.ws = ws;
      // Register the persistent error handler BEFORE awaiting open — without
      // it, an error fired during the upgrade (UDS missing, daemon down,
      // bad URL) is "unhandled" and crashes the process under Bun. The
      // once('error') below covers the connect-time rejection; this on()
      // covers later errors and the rare double-emit.
      ws.on('error', err => log.warn({ err: errMsg(err) }, 'codex-rc websocket error'));
      await new Promise<void>((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', err => reject(err));
      });
      ws.on('message', data => this.onMessage(data));
      ws.on('close', () => this.onClose());

      await this.call('initialize', {
        clientInfo: { name: 'metro', version: this.clientVersion, title: null },
      });

      try {
        const list = await this.call<{ data?: Array<{ id: string; status?: string }> }>('thread/list', {});
        const active = (list.data ?? []).find(t => t.status !== 'archived');
        if (active) this.threadId = active.id;
      } catch (err) {
        log.warn({ err: errMsg(err) }, 'codex-rc thread/list failed (non-fatal)');
      }

      this.connected = true;
      log.info({ url: this.displayUrl, thread: this.threadId ?? '(none yet)' }, 'codex-rc connected');
      void this.drainQueue();
    } catch (err) {
      log.warn({ err: errMsg(err), url: this.displayUrl }, 'codex-rc connect failed; retrying');
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onMessage(raw: RawData): void {
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'codex-rc malformed message');
      return;
    }

    log.debug({ id: msg.id, method: msg.method, hasError: !!msg.error }, 'codex-rc ← message');

    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? 'rpc error'));
      else p.resolve(msg.result);
      return;
    }

    if (msg.method === 'thread/started') {
      const params = msg.params as { thread?: { id: string } } | undefined;
      if (params?.thread?.id) {
        this.threadId = params.thread.id;
        log.info({ thread: this.threadId }, 'codex-rc thread started');
        void this.drainQueue();
      }
    } else if (msg.method === 'turn/completed') {
      log.debug({ thread: this.threadId, queue: this.queue.length }, 'codex-rc turn/completed; draining');
      this.clearTurnTimeout();
      this.turnInFlight = false;
      void this.drainQueue();
    } else if (msg.method === 'turn/started') {
      log.debug({ thread: this.threadId }, 'codex-rc turn/started');
      this.turnInFlight = true;
    } else if (msg.method === 'thread/closed' || msg.method === 'thread/archived') {
      log.warn({ method: msg.method, params: msg.params }, 'codex-rc thread closed/archived; clearing thread reference');
      this.threadId = null;
    }
  }

  private onClose(): void {
    if (this.closed) return;
    this.connected = false;
    this.ws = null;
    for (const p of this.pending.values()) p.reject(new Error('websocket closed'));
    this.pending.clear();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.connected = false;
    setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
  }

  private async drainQueue(): Promise<void> {
    if (!this.connected || !this.threadId || this.turnInFlight) return;
    if (this.queue.length === 0) return;
    const line = this.queue[0];
    this.turnInFlight = true;
    this.armTurnTimeout();
    log.debug({ thread: this.threadId, queue: this.queue.length }, 'codex-rc → turn/start');
    try {
      await this.call('turn/start', {
        threadId: this.threadId,
        input: [{ type: 'text', text: line, textElements: [] }],
      });
      this.queue.shift();
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'codex-rc turn/start failed; will retry');
      this.clearTurnTimeout();
      this.turnInFlight = false;
      setTimeout(() => void this.drainQueue(), 1_000);
    }
  }

  // If `turn/completed` never arrives (the daemon doesn't broadcast it to
  // metro's connection, or we miss it for any reason), unstick after the
  // backstop so subsequent inbounds don't queue forever.
  private armTurnTimeout(): void {
    this.clearTurnTimeout();
    this.turnTimeout = setTimeout(() => {
      log.warn({ thread: this.threadId, queue: this.queue.length }, `codex-rc turn/completed not received within ${TURN_TIMEOUT_MS}ms; force-clearing single-flight gate`);
      this.turnInFlight = false;
      this.turnTimeout = null;
      void this.drainQueue();
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimeout(): void {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
  }

  private call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.ws) return Promise.reject(new Error('not connected'));
    const id = this.nextId++;
    const ws = this.ws;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
}
