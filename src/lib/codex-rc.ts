// JSON-RPC over WebSocket client for the Codex app-server (`codex
// app-server --listen ws://…` or `codex remote-control`). Mirrors what
// Claude Code's `Monitor` does for stdout — pushes each metro inbound into
// the agent's history and triggers a turn — so the Codex agent reacts
// without polling.
//
// Wire format: standard JSON-RPC 2.0 over WebSocket. Methods we use:
//   - initialize                → handshake, declares clientInfo.
//   - thread/list               → discover existing threads on connect.
//   - thread/started            → notification; track new threads as they appear.
//   - turn/completed            → notification; drain queued inbounds.
//   - turn/start                → push a user message and wake the agent.
//
// If no thread exists yet, inbounds queue in memory; they fire as soon as
// a thread is started or learned. If the connection drops, reconnect with
// linear backoff and replay the queue. Connection failures don't break
// metro — stdout emit always runs first, so Claude Code Monitor users keep
// working regardless.

import { errMsg, log } from '../log.js';

type Pending = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

type Inbound = string;

const RECONNECT_DELAY_MS = 2_000;
const MAX_QUEUE = 100;

export class CodexRC {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private threadId: string | null = null;
  private queue: Inbound[] = [];
  private connected = false;
  private connecting = false;
  private turnInFlight = false;
  private closed = false;

  constructor(private url: string, private clientVersion: string) {}

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
      log.warn({ url: this.url }, 'codex-rc queue full, dropping oldest inbound');
      this.queue.shift();
    }
    this.queue.push(line);
    void this.drainQueue();
  }

  private async connect(): Promise<void> {
    if (this.closed || this.connected || this.connecting) return;
    this.connecting = true;
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error('websocket error')), { once: true });
      });
      ws.addEventListener('message', e => this.onMessage(e));
      ws.addEventListener('close', () => this.onClose());

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
      log.info({ url: this.url, thread: this.threadId ?? '(none yet)' }, 'codex-rc connected');
      void this.drainQueue();
    } catch (err) {
      log.warn({ err: errMsg(err), url: this.url }, 'codex-rc connect failed; retrying');
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onMessage(event: MessageEvent): void {
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data as ArrayBuffer).toString('utf8'));
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'codex-rc malformed message');
      return;
    }

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
      this.turnInFlight = false;
      void this.drainQueue();
    } else if (msg.method === 'turn/started') {
      this.turnInFlight = true;
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
    try {
      await this.call('turn/start', {
        threadId: this.threadId,
        input: [{ type: 'text', text: line, textElements: [] }],
      });
      this.queue.shift();
    } catch (err) {
      log.warn({ err: errMsg(err) }, 'codex-rc turn/start failed; will retry');
      this.turnInFlight = false;
      // Don't shift — leave at head for retry. If the error is permanent
      // (e.g. thread closed), `turn/completed` won't fire and the queue
      // will sit until reconnect or new thread/started.
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
