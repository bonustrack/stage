/** JSON-RPC/WS client for codex app-server: each event → `turn/start`. */

import { WebSocket, type RawData } from 'ws';
import { errMsg, log } from '../log.js';
import {
  buildTurnInput, encodeRpc, extractThreadStartedId, isStatusActive, openSocket, parseUrl,
  type Endpoint, type RpcMessage,
} from './protocol.js';

type Pending = { resolve: (result: unknown) => void; reject: (err: Error) => void };

const RECONNECT_DELAY_MS = 2_000;
const MAX_QUEUE = 100;
/** Backstop in case `turn/completed` never arrives — unstick the single-flight gate. */
const TURN_TIMEOUT_MS = 120_000;

export class CodexRC {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private threadId: string | null = null;
  private threadListener: ((id: string | null) => void) | null = null;
  private queue: string[] = [];
  private connected = false;
  private connecting = false;
  private turnInFlight = false;
  private turnTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private endpoint: Endpoint;

  constructor(private url: string, private clientVersion: string) {
    this.endpoint = parseUrl(url);
  }

  start(): void { void this.connect(); }

  getThreadId(): string | null { return this.threadId; }
  onThread(listener: (id: string | null) => void): void { this.threadListener = listener; }
  private setThreadId(id: string | null): void {
    if (this.threadId === id) return;
    this.threadId = id;
    this.threadListener?.(id);
  }
  stop(): void {
    this.closed = true;
    this.clearTurnTimeout();
    this.ws?.close();
    this.ws = null;
  }

  push(line: string): void {
    if (this.queue.length >= MAX_QUEUE) {
      log.warn({ url: this.url }, 'codex-rc queue full, dropping oldest');
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
      ws.on('error', err => log.warn({ err: errMsg(err) }, 'codex-rc websocket error'));
      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', err => reject(err));
      });
      ws.on('message', data => this.onMessage(data));
      ws.on('close', () => this.onClose());

      const clientInfo = { name: 'metro', version: this.clientVersion, title: null };
      await this.call('initialize', { clientInfo });
      this.setThreadId(await this.pickOrCreateThread());

      this.connected = true;
      log.info({ url: this.url, thread: this.threadId ?? '(none yet)' }, 'codex-rc connected');
      void this.drainQueue();
    } catch (err) {
      log.warn({ err: errMsg(err), url: this.url }, 'codex-rc connect failed; retrying');
      this.scheduleReconnect();
    } finally { this.connecting = false; }
  }

  private onMessage(raw: RawData): void {
    let msg: RpcMessage;
    try { msg = JSON.parse(raw.toString()); }
    catch (err) { log.warn({ err: errMsg(err) }, 'codex-rc malformed message'); return; }

    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? 'rpc error'));
      else p.resolve(msg.result);
      return;
    }
    this.handleNotification(msg);
  }

  private handleNotification(msg: RpcMessage): void {
    switch (msg.method) {
      case 'thread/started': {
        const id = extractThreadStartedId(msg.params);
        if (id) { this.setThreadId(id); log.info({ thread: id }, 'codex-rc thread started'); void this.drainQueue(); }
        break;
      }
      case 'thread/status/changed': {
        const s = isStatusActive(msg.params, this.threadId);
        if (!s.match) break;
        if (s.active) this.turnInFlight = true;
        else { this.clearTurnTimeout(); this.turnInFlight = false; void this.drainQueue(); }
        break;
      }
      case 'turn/completed':
        this.clearTurnTimeout(); this.turnInFlight = false; void this.drainQueue(); break;
      case 'turn/started':
        this.turnInFlight = true; break;
      case 'thread/closed':
      case 'thread/archived':
        log.warn({ method: msg.method }, 'codex-rc thread closed/archived');
        this.setThreadId(null);
        break;
    }
  }

  private onClose(): void {
    if (this.closed) return;
    this.connected = false; this.ws = null;
    for (const p of this.pending.values()) p.reject(new Error('websocket closed'));
    this.pending.clear();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.connected = false;
    setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
  }

  /** Prefer the most-recently-loaded thread (the TUI's if attached); else create our own. */
  private async pickOrCreateThread(): Promise<string | null> {
    try {
      const loaded = await this.call<{ data?: string[] }>('thread/loaded/list', {});
      const existing = loaded.data?.[loaded.data.length - 1];
      if (existing) return existing;
    } catch (err) { log.warn({ err: errMsg(err) }, 'codex-rc thread/loaded/list failed'); }
    try {
      const created = await this.call<{ thread?: { id: string } }>('thread/start', {});
      return created.thread?.id ?? null;
    } catch (err) { log.warn({ err: errMsg(err) }, 'codex-rc thread/start failed'); return null; }
  }

  private async drainQueue(): Promise<void> {
    if (!this.connected || this.turnInFlight || !this.queue.length) return;
    if (!this.threadId) { this.setThreadId(await this.pickOrCreateThread()); if (!this.threadId) return; }
    const line = this.queue[0];
    this.turnInFlight = true;
    this.armTurnTimeout();
    try {
      await this.call('turn/start', { threadId: this.threadId, input: buildTurnInput(line) });
      this.queue.shift();
    } catch (err) {
      const dead = errMsg(err).includes('thread not found');
      log.warn({ err: errMsg(err) }, dead ? 'codex-rc thread gone; will create a new one' : 'codex-rc turn/start failed; will retry');
      this.clearTurnTimeout(); this.turnInFlight = false;
      if (dead) this.setThreadId(null);
      setTimeout(() => void this.drainQueue(), 1_000);
    }
  }

  private armTurnTimeout(): void {
    this.clearTurnTimeout();
    this.turnTimeout = setTimeout(() => {
      log.warn({ thread: this.threadId, queue: this.queue.length },
        `codex-rc turn/completed not received within ${TURN_TIMEOUT_MS}ms; force-clearing gate`);
      this.turnInFlight = false; this.turnTimeout = null;
      void this.drainQueue();
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimeout(): void {
    if (this.turnTimeout) { clearTimeout(this.turnTimeout); this.turnTimeout = null; }
  }

  private call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.ws) return Promise.reject(new Error('not connected'));
    const id = this.nextId++;
    const ws = this.ws;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      ws.send(encodeRpc(id, method, params));
    });
  }
}
