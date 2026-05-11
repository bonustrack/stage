/** Codex station: spawns `codex app-server` over UDS WebSocket; one thread/scope, streams turn events. */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { WebSocket, type RawData } from 'ws';
import { AsyncQueue } from '../helpers/async-queue.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import type { AgentStation, Capabilities, ToolActivity, TurnEvent, TurnRequest } from './types.js';

const SOCKET_PATH = join(STATE_DIR, 'codex-app-server.sock');
const READY_TIMEOUT_MS = 15_000;
const READY_POLL_MS = 100;

type Pending = { resolve: (r: unknown) => void; reject: (e: Error) => void };
type ThreadItem =
  | { type: 'agentMessage'; id: string; text: string }
  | { type: 'commandExecution'; id: string; command: string; output?: string; exitCode?: number }
  | { type: 'fileChange'; id: string; changes: { path?: string }[] }
  | { type: 'reasoning'; id: string }
  | { type: string; id: string };

type ActiveTurn = { queue: AsyncQueue<TurnEvent>; turnId?: string; cancelled: boolean };

export const CAPABILITIES: Capabilities = { in: ['text', 'image'], out: ['text'], features: ['stream', 'tools', 'cancel', 'attachments'] };

export class CodexStation implements AgentStation {
  readonly name = 'codex';
  readonly capabilities = CAPABILITIES;

  private ws: WebSocket | null = null;
  private daemon: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private turns = new Map<string, ActiveTurn>();

  constructor(private clientVersion: string) {}

  async start(): Promise<void> {
    await this.checkCodexInstalled();
    try { unlinkSync(SOCKET_PATH); } catch { /* missing is fine */ }
    log.info({ socket: SOCKET_PATH }, 'codex station: starting app-server');
    this.daemon = spawn('codex', ['app-server', '--listen', `unix://${SOCKET_PATH}`], { stdio: ['ignore', 'pipe', 'pipe'] });

    let bootStderr = '', daemonExited = false, daemonExitCode: number | null = null;
    this.daemon.stdout?.on('data', d => log.trace({ src: 'codex-stdout' }, String(d).trim()));
    this.daemon.stderr?.on('data', (d: Buffer) => { bootStderr += String(d); log.trace({ src: 'codex-stderr' }, String(d).trim()); });
    this.daemon.on('exit', code => { daemonExited = true; daemonExitCode = code; log.warn({ code }, 'codex daemon exited'); });

    try { await this.waitForSocket(() => daemonExited, () => bootStderr.trim() || `exit code ${daemonExitCode}`); await this.connect(); }
    catch (err) { throw new Error(`${errMsg(err)}${bootStderr.trim() ? ` (codex stderr: ${bootStderr.trim().slice(0, 200)})` : ''}`); }
    log.info('codex station: ready');
  }

  private async checkCodexInstalled(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const c = spawn('codex', ['--version'], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; c.stderr?.on('data', d => { stderr += String(d); });
      c.on('error', err => reject(new Error(`codex CLI not found on PATH: ${errMsg(err)}`)));
      c.on('exit', code => code === 0 ? resolve() : reject(new Error(`codex --version exited ${code}: ${stderr.trim()}`)));
    });
  }

  async stop(): Promise<void> {
    this.ws?.close(); this.ws = null;
    this.daemon?.kill('SIGTERM'); this.daemon = null;
  }

  async createThread(): Promise<string> {
    const result = await this.call<{ thread: { id: string } }>('thread/start', {});
    log.info({ thread: result.thread.id }, 'codex station: thread created');
    return result.thread.id;
  }

  sendTurn(req: TurnRequest): AsyncIterable<TurnEvent> {
    const queue = new AsyncQueue<TurnEvent>();
    const turn: ActiveTurn = { queue, cancelled: false };
    this.turns.set(req.threadId, turn);
    void this.startTurn(req, turn);
    return queue;
  }

  private async startTurn(req: TurnRequest, turn: ActiveTurn): Promise<void> {
    const onAbort = (): void => { turn.cancelled = true; void this.interrupt(req.threadId, turn); };
    req.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      /** `text_elements` is snake_case per codex's generated bindings; images go as `image_url` data URIs. */
      const input: unknown[] = [{ type: 'text', text: req.text, text_elements: [] }];
      for (const a of req.attachments) input.push({ type: 'image', image_url: `data:${a.mediaType};base64,${a.data.toString('base64')}` });
      const result = await this.call<{ turn: { id: string } }>('turn/start', { threadId: req.threadId, input });
      if (result?.turn?.id) turn.turnId = result.turn.id;
    } catch (err) { this.endTurn(req.threadId); turn.queue.fail(err instanceof Error ? err : new Error(String(err))); }
  }

  private async interrupt(threadId: string, turn: ActiveTurn): Promise<void> {
    if (!turn.turnId) return;
    await this.call('turn/interrupt', { threadId, turnId: turn.turnId })
      .catch(err => log.warn({ err: errMsg(err) }, 'codex station: turn/interrupt failed'));
  }

  private async waitForSocket(exited: () => boolean, exitReason: () => string): Promise<void> {
    for (const deadline = Date.now() + READY_TIMEOUT_MS; Date.now() < deadline;) {
      if (exited()) throw new Error(`codex app-server exited before listening: ${exitReason()}`);
      if (existsSync(SOCKET_PATH)) return;
      await new Promise(r => setTimeout(r, READY_POLL_MS));
    }
    throw new Error(`codex app-server didn't appear at ${SOCKET_PATH} within ${READY_TIMEOUT_MS}ms`);
  }

  /** perMessageDeflate disabled: codex 0.130 closes connections offering it. */
  private async connect(): Promise<void> {
    const ws = new WebSocket('ws://localhost/', { perMessageDeflate: false, createConnection: () => {
      const sock = createConnection({ path: SOCKET_PATH });
      sock.on('error', err => log.warn({ err: errMsg(err) }, 'codex station: socket error'));
      return sock;
    } });
    this.ws = ws;
    ws.on('error', err => log.warn({ err: errMsg(err) }, 'codex station: websocket error'));
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
    ws.on('message', data => this.onMessage(data));
    ws.on('close', () => { log.warn('codex station: websocket closed'); this.ws = null; this.drainPending('codex websocket closed'); });
    await this.call('initialize', { clientInfo: { name: 'metro', version: this.clientVersion, title: null } });
  }

  private onMessage(raw: RawData): void {
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
    try { msg = JSON.parse(raw.toString()); }
    catch (err) { log.warn({ err: errMsg(err) }, 'codex station: malformed message'); return; }

    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!; this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? 'rpc error')); else p.resolve(msg.result);
      return;
    }
    if (!msg.method) return;
    log.trace({ method: msg.method }, 'codex station: notification');
    const threadId = (msg.params as { threadId?: string } | undefined)?.threadId;
    if (!threadId) return;
    const turn = this.turns.get(threadId);
    if (!turn) return;
    /** codex 0.130: `thread/status=idle` is the dependable completion signal. */
    if (msg.method === 'item/agentMessage/delta') turn.queue.push({ type: 'delta', text: (msg.params as { delta: string }).delta });
    else if (msg.method === 'item/started') { const a = summarizeItem((msg.params as { item: ThreadItem }).item); if (a) turn.queue.push({ type: 'tool-start', activity: a }); }
    else if (msg.method === 'item/completed') {
      const item = (msg.params as { item: ThreadItem }).item;
      if (item.type !== 'agentMessage' && item.type !== 'userMessage') turn.queue.push({ type: 'tool-end', id: item.id, result: itemOutput(item) });
    } else if (msg.method === 'thread/status/changed') {
      const status = (msg.params as { status: { type: string } }).status?.type;
      if (status === 'idle') this.finish(threadId, turn);
      else if (status === 'systemError') { this.endTurn(threadId); turn.queue.fail(new Error('codex thread entered systemError')); }
    } else if (msg.method === 'turn/completed') this.finish(threadId, turn);
    else if (msg.method === 'error') { this.endTurn(threadId); turn.queue.fail(new Error((msg.params as { error?: { message?: string } }).error?.message ?? 'codex error notification')); }
  }

  /** Idle/turn-completed: surface "Interrupted" if abort triggered it, else complete normally. */
  private finish = (threadId: string, turn: ActiveTurn): void => {
    this.endTurn(threadId);
    if (turn.cancelled) turn.queue.fail(new Error('Interrupted')); else turn.queue.finish();
  };

  private endTurn = (threadId: string): void => { this.turns.delete(threadId); };

  private call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.ws) return Promise.reject(new Error('codex station: not connected'));
    const id = this.nextId++; const ws = this.ws;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  private drainPending(reason: string): void {
    const err = new Error(reason);
    for (const turn of this.turns.values()) {
      try { turn.queue.fail(err); } catch (e) { log.warn({ err: errMsg(e) }, 'codex station: drain queue threw'); }
    }
    this.turns.clear();
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

function summarizeItem(item: ThreadItem): ToolActivity | null {
  const id = item.id;
  if (item.type === 'commandExecution' && 'command' in item) return { id, kind: 'commandExecution', name: 'Bash', detail: item.command || undefined };
  if (item.type === 'fileChange' && 'changes' in item) {
    const paths = (item.changes ?? []).map(c => c.path).filter((p): p is string => !!p);
    return { id, kind: 'fileChange', name: 'Edit', detail: paths.length === 1 ? paths[0] : paths.length ? `${paths.length} files` : undefined };
  }
  if (item.type === 'reasoning') return { id, kind: 'reasoning', name: 'Thinking…', transient: true };
  if (item.type === 'agentMessage' || item.type === 'userMessage') return null;
  return { id, kind: item.type, name: item.type };
}

const itemOutput = (item: ThreadItem): string | undefined =>
  item.type === 'commandExecution' && 'output' in item ? item.output?.trim() || undefined : undefined;
