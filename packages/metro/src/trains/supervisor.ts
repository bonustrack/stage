/** Train supervisor: spawn `~/.metro/trains/*.{ts,js,mjs}` under `bun run`, multiplex their */
/** stdout (events + call-responses), route outbound calls to their stdin. Pure transport. */

import { mkdirSync, statSync, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { daemonSelf } from '../history.js';
import {
  drainLines, failAllPending, listTrainFiles, mintCallId, parseTrainLine, sendCall,
  type TrainCallResponse, type TrainEvent,
} from './protocol.js';
import {
  MAX_CONSECUTIVE_FAILS, RESTART_BACKOFFS_MS,
  killGracefully, pumpStream, startWatcher, type TrainState,
} from './supervisor-io.js';

export const TRAINS_DIR = process.env.METRO_TRAINS_DIR ?? join(homedir(), '.metro', 'trains');

export type TrainInfo = {
  name: string; path: string; running: boolean; pid: number | null;
  startedAt: string | null; failCount: number;
};

export class TrainSupervisor {
  private trains = new Map<string, TrainState>();
  private onEvent: ((event: TrainEvent, train: string) => void) | null = null;
  private nextCallId = 1;
  private watcher: FSWatcher | null = null;
  private reloadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private dir: string = TRAINS_DIR) {}

  onTrainEvent(handler: (event: TrainEvent, train: string) => void): void { this.onEvent = handler; }

  /** Discover trains under `dir` and spawn one subprocess per file. Creates the dir if missing. */
  start(): void {
    mkdirSync(this.dir, { recursive: true });
    for (const t of listTrainFiles(this.dir)) this.startTrain(t.name, t.path);
    log.info({ dir: this.dir, count: this.trains.size }, 'train supervisor: started');
    this.watchForReloads();
  }

  private watchForReloads(): void {
    this.watcher = startWatcher(this.dir, this.reloadTimers,
      (name, path) => this.handleSourceChange(name, path));
  }

  /** A train source file changed (or appeared). Restart it if known, else spawn it. */
  private handleSourceChange(name: string, path: string): void {
    const known = this.trains.get(name);
    if (known) {
      /** Deleted file: leave the running process; nothing to reload onto. */
      try { if (!statSync(path).isFile()) return; } catch { return; }
      log.info({ name }, 'train hot-reload: source changed, restarting');
      void this.restart(name).catch(err => log.warn({ name, err: errMsg(err) }, 'train hot-reload: restart failed'));
      return;
    }
    try { if (!statSync(path).isFile()) return; } catch { return; }
    log.info({ name }, 'train hot-reload: new train, spawning');
    this.startTrain(name, path);
  }

  /** Shut everything down (graceful: send SIGTERM, then SIGKILL after grace period). */
  async stop(): Promise<void> {
    if (this.watcher) { try { this.watcher.close(); } catch { /* ignore */ } this.watcher = null; }
    for (const timer of this.reloadTimers.values()) clearTimeout(timer);
    this.reloadTimers.clear();
    const tasks: Promise<unknown>[] = [];
    for (const t of this.trains.values()) {
      t.stopped = true;
      if (t.restartTimer) { clearTimeout(t.restartTimer); t.restartTimer = null; }
      failAllPending(t.pending, 'train shutting down');
      const wait = killGracefully(t.proc);
      if (wait) tasks.push(wait);
    }
    await Promise.all(tasks);
  }

  list(): TrainInfo[] {
    return [...this.trains.values()].map(t => ({
      name: t.name, path: t.path, running: !!(t.proc && t.proc.exitCode === null),
      pid: t.proc?.pid ?? null, startedAt: t.startedAt, failCount: t.failCount,
    }));
  }

  /** Kill + respawn a named train; resets fail counter so backoff starts fresh. */
  async restart(name: string): Promise<void> {
    const t = this.trains.get(name);
    if (!t) throw new Error(`no train named '${name}'`);
    if (t.restartTimer) { clearTimeout(t.restartTimer); t.restartTimer = null; }
    failAllPending(t.pending, `train '${name}' restarting`);
    t.stopped = true;
    const wait = killGracefully(t.proc);
    if (wait) await wait;
    t.stopped = false; t.failCount = 0; t.proc = null;
    this.spawn(t);
  }

  /** Send a call to a named train and await the matching response. */
  async call(name: string, action: string, args: unknown): Promise<TrainCallResponse> {
    const t = this.trains.get(name);
    if (!t) throw new Error(`no train named '${name}' (have: ${[...this.trains.keys()].join(', ') || '(none)'})`);
    if (!t.proc || t.proc.exitCode !== null) throw new Error(`train '${name}' is not running`);
    return sendCall(t as never, mintCallId(this.nextCallId++), action, args);
  }

  private startTrain(name: string, path: string): void {
    if (this.trains.has(name)) { log.warn({ name }, 'train supervisor: duplicate name, skipping'); return; }
    const state: TrainState = {
      name, path, proc: null, pending: new Map(), buf: '', errBuf: '',
      failCount: 0, restartTimer: null, startedAt: null, stopped: false,
    };
    this.trains.set(name, state);
    this.spawn(state);
  }

  private spawn(state: TrainState): void {
    if (state.stopped) return;
    try {
      const proc = Bun.spawn(['bun', 'run', state.path], {
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
        env: { ...process.env, METRO_TRAIN_NAME: state.name, METRO_SELF_URI: daemonSelf() },
      });
      state.proc = proc; state.startedAt = new Date().toISOString();
      state.buf = ''; state.errBuf = '';
      log.info({ name: state.name, pid: proc.pid }, 'train: spawned');
      void this.pumpStdout(state); void this.pumpStderr(state);
      void proc.exited.then(code => this.onExit(state, code ?? 0));
    } catch (err) {
      log.warn({ name: state.name, err: errMsg(err) }, 'train: spawn failed');
      this.scheduleRestart(state);
    }
  }

  private pumpStdout(state: TrainState): Promise<void> {
    return pumpStream(state.proc?.stdout, state.name, 'stdout', chunk => {
      state.buf += chunk;
      state.buf = drainLines(state.name, state.buf, line => this.handleLine(state, line));
    });
  }

  /** Stream train stderr line-by-line into the daemon's logger so users see crashes/warnings. */
  private pumpStderr(state: TrainState): Promise<void> {
    return pumpStream(state.proc?.stderr, state.name, 'stderr', chunk => {
      state.errBuf += chunk;
      let nl;
      while ((nl = state.errBuf.indexOf('\n')) !== -1) {
        const line = state.errBuf.slice(0, nl).trimEnd();
        state.errBuf = state.errBuf.slice(nl + 1);
        if (line) log.warn({ train: state.name }, line);
      }
    });
  }

  private handleLine(state: TrainState, line: string): void {
    const msg = parseTrainLine(state.name, line);
    if (!msg || msg.op === 'ignore') return;
    if (msg.op === 'response') {
      const pending = state.pending.get(msg.id);
      if (!pending) { log.debug({ name: state.name, id: msg.id }, 'train: stale response'); return; }
      state.pending.delete(msg.id);
      clearTimeout(pending.timer);
      pending.resolve({ result: msg.result, error: msg.error, errorInfo: msg.errorInfo });
      return;
    }
    if (msg.op === 'log') { log.info({ name: state.name, msg: msg.text }, 'train log'); return; }
    this.onEvent?.(msg.event, state.name);
  }

  private onExit(state: TrainState, code: number): void {
    log.warn({ name: state.name, code }, 'train: exited');
    state.proc = null;
    state.startedAt = null;
    failAllPending(state.pending, `train '${state.name}' exited (code=${code}) before responding`);
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
