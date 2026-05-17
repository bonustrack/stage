/** Train supervisor: spawn `~/.metro/trains/*.{ts,js,mjs}` under `bun run`, multiplex their */
/** stdout (events + call-responses), route outbound calls to their stdin. Pure transport. */

import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, parse as parsePath } from 'node:path';
import { errMsg, log } from './log.js';

const RESTART_BACKOFFS_MS = [1_000, 5_000, 30_000] as const;
const MAX_CONSECUTIVE_FAILS = 5;
const CALL_TIMEOUT_MS = 60_000;
const STDOUT_LINE_MAX = 4 * 1024 * 1024; // 4 MiB safeguard per line

export const TRAINS_DIR = process.env.METRO_TRAINS_DIR ?? join(homedir(), '.metro', 'trains');

export type TrainEvent = Record<string, unknown>;
export type TrainCallResponse = { result?: unknown; error?: string };

type Pending = {
  resolve: (r: TrainCallResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type TrainState = {
  name: string;
  path: string;
  proc: ReturnType<typeof Bun.spawn> | null;
  pending: Map<string, Pending>;
  buf: string;
  failCount: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
  startedAt: string | null;
  stopped: boolean;
};

export type TrainInfo = {
  name: string;
  path: string;
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  failCount: number;
};

export class TrainSupervisor {
  private trains = new Map<string, TrainState>();
  private onEvent: ((event: TrainEvent, train: string) => void) | null = null;
  private nextCallId = 1;

  constructor(private dir: string = TRAINS_DIR) {}

  onTrainEvent(handler: (event: TrainEvent, train: string) => void): void {
    this.onEvent = handler;
  }

  /** Discover trains under `dir` and spawn one subprocess per file. Creates the dir if missing. */
  start(): void {
    mkdirSync(this.dir, { recursive: true });
    const files = readdirSync(this.dir).filter(isTrainFile)
      .map(f => ({ name: parsePath(f).name, path: join(this.dir, f) }))
      .filter(t => { try { return statSync(t.path).isFile(); } catch { return false; } });
    for (const t of files) this.startTrain(t.name, t.path);
    log.info({ dir: this.dir, count: this.trains.size }, 'train supervisor: started');
  }

  /** Shut everything down (graceful: send SIGTERM, then SIGKILL after grace period). */
  async stop(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const t of this.trains.values()) {
      t.stopped = true;
      if (t.restartTimer) { clearTimeout(t.restartTimer); t.restartTimer = null; }
      for (const p of t.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('train shutting down'));
      }
      t.pending.clear();
      if (t.proc && t.proc.exitCode === null) {
        try { t.proc.kill('SIGTERM'); } catch { /* ignore */ }
        const grace = setTimeout(() => { try { t.proc?.kill('SIGKILL'); } catch { /* ignore */ } }, 2_000);
        tasks.push(t.proc.exited.finally(() => clearTimeout(grace)));
      }
    }
    await Promise.all(tasks);
  }

  list(): TrainInfo[] {
    return [...this.trains.values()].map(t => ({
      name: t.name, path: t.path,
      running: !!(t.proc && t.proc.exitCode === null),
      pid: t.proc?.pid ?? null,
      startedAt: t.startedAt,
      failCount: t.failCount,
    }));
  }

  /** Send a call to a named train and await the matching response. */
  async call(name: string, action: string, args: unknown): Promise<TrainCallResponse> {
    const t = this.trains.get(name);
    if (!t) throw new Error(`no train named '${name}' (have: ${[...this.trains.keys()].join(', ') || '(none)'})`);
    if (!t.proc || t.proc.exitCode !== null) throw new Error(`train '${name}' is not running`);
    const id = `req_${this.nextCallId++}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = JSON.stringify({ op: 'call', id, action, args }) + '\n';
    return new Promise<TrainCallResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        t.pending.delete(id);
        reject(new Error(`train '${name}' call '${action}' timed out after ${CALL_TIMEOUT_MS}ms`));
      }, CALL_TIMEOUT_MS);
      t.pending.set(id, { resolve, reject, timer });
      try {
        const stdin = t.proc!.stdin;
        if (!stdin || typeof stdin === 'number') throw new Error('stdin not piped');
        stdin.write(payload);
        stdin.flush();
      } catch (err) {
        clearTimeout(timer);
        t.pending.delete(id);
        reject(new Error(`train '${name}' stdin write failed: ${errMsg(err)}`));
      }
    });
  }

  private startTrain(name: string, path: string): void {
    if (this.trains.has(name)) {
      log.warn({ name }, 'train supervisor: duplicate name, skipping');
      return;
    }
    const state: TrainState = {
      name, path, proc: null, pending: new Map(), buf: '',
      failCount: 0, restartTimer: null, startedAt: null, stopped: false,
    };
    this.trains.set(name, state);
    this.spawn(state);
  }

  private spawn(state: TrainState): void {
    if (state.stopped) return;
    try {
      const proc = Bun.spawn(['bun', 'run', state.path], {
        stdin: 'pipe', stdout: 'pipe', stderr: 'inherit',
        env: { ...process.env, METRO_TRAIN_NAME: state.name },
      });
      state.proc = proc;
      state.startedAt = new Date().toISOString();
      state.buf = '';
      log.info({ name: state.name, pid: proc.pid }, 'train: spawned');
      void this.pumpStdout(state);
      void proc.exited.then(code => this.onExit(state, code ?? 0));
    } catch (err) {
      log.warn({ name: state.name, err: errMsg(err) }, 'train: spawn failed');
      this.scheduleRestart(state);
    }
  }

  private async pumpStdout(state: TrainState): Promise<void> {
    const proc = state.proc;
    if (!proc || !proc.stdout) return;
    const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
    const dec = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        state.buf += dec.decode(value, { stream: true });
        if (state.buf.length > STDOUT_LINE_MAX && !state.buf.includes('\n')) {
          log.warn({ name: state.name, bytes: state.buf.length }, 'train: dropping oversized stdout line');
          state.buf = '';
        }
        let nl;
        while ((nl = state.buf.indexOf('\n')) !== -1) {
          const line = state.buf.slice(0, nl).trim();
          state.buf = state.buf.slice(nl + 1);
          if (!line) continue;
          this.handleLine(state, line);
        }
      }
    } catch (err) {
      log.debug({ name: state.name, err: errMsg(err) }, 'train: stdout pump ended');
    }
  }

  private handleLine(state: TrainState, line: string): void {
    let msg: { op?: string; id?: string; result?: unknown; error?: string } & Record<string, unknown>;
    try { msg = JSON.parse(line); }
    catch (err) {
      log.warn({ name: state.name, err: errMsg(err), line: line.slice(0, 200) }, 'train: bad JSON');
      return;
    }
    if (msg.op === 'response') {
      const id = msg.id;
      if (typeof id !== 'string') return;
      const pending = state.pending.get(id);
      if (!pending) {
        log.debug({ name: state.name, id }, 'train: response for unknown id (timed out?)');
        return;
      }
      state.pending.delete(id);
      clearTimeout(pending.timer);
      pending.resolve({ result: msg.result, error: msg.error });
      return;
    }
    if (msg.op === 'log') {
      log.info({ name: state.name, msg: msg.text }, 'train log');
      return;
    }
    /** Anything without an `op` (or with `op:"event"`) is an inbound event. */
    this.onEvent?.(msg as TrainEvent, state.name);
  }

  private onExit(state: TrainState, code: number): void {
    log.warn({ name: state.name, code }, 'train: exited');
    state.proc = null;
    state.startedAt = null;
    /** fail pending calls */
    for (const p of state.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(`train '${state.name}' exited (code=${code}) before responding`));
    }
    state.pending.clear();
    if (state.stopped) return;
    state.failCount++;
    if (state.failCount >= MAX_CONSECUTIVE_FAILS) {
      log.error({ name: state.name, fails: state.failCount },
        'train: too many consecutive failures, giving up (restart metro to retry)');
      return;
    }
    this.scheduleRestart(state);
  }

  private scheduleRestart(state: TrainState): void {
    if (state.stopped) return;
    const idx = Math.min(state.failCount, RESTART_BACKOFFS_MS.length - 1);
    const delay = RESTART_BACKOFFS_MS[idx];
    log.info({ name: state.name, delay, attempt: state.failCount }, 'train: restart scheduled');
    state.restartTimer = setTimeout(() => {
      state.restartTimer = null;
      /** Any subprocess that survives 30s resets its consecutive-fail counter. */
      this.spawn(state);
      setTimeout(() => { if (state.proc && state.proc.exitCode === null) state.failCount = 0; }, 30_000);
    }, delay);
  }
}

function isTrainFile(name: string): boolean {
  return /\.(ts|js|mjs)$/.test(name) && !name.startsWith('_') && !name.startsWith('.');
}
