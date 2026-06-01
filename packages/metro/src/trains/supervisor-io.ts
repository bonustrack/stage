/** Supervisor internals: tunables, per-train state shape, and process/stream plumbing. */

import { watch, type FSWatcher } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { errMsg, log } from '../log.js';
import type { Pending } from './protocol.js';

export const RESTART_BACKOFFS_MS = [1_000, 5_000, 30_000] as const;
export const MAX_CONSECUTIVE_FAILS = 5;
/** Debounce window for the hot-reload watcher: editors fire several fs events per save. */
export const HOT_RELOAD_DEBOUNCE_MS = 300;
export const TRAIN_EXT = /\.(ts|js|mjs)$/;

export type TrainState = {
  name: string; path: string; proc: ReturnType<typeof Bun.spawn> | null;
  pending: Map<string, Pending>; buf: string; errBuf: string; failCount: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
  startedAt: string | null; stopped: boolean;
};

// Hot-reload (#15): watch `dir`, debounce per-train, hand the changed file to
// `onChange`. New file ⇒ fresh train; deleted file ⇒ caller leaves the process.
// Best-effort: if `watch` is unavailable, on-demand restart still works.
export function startWatcher(
  dir: string, timers: Map<string, ReturnType<typeof setTimeout>>,
  onChange: (name: string, path: string) => void,
): FSWatcher | null {
  try {
    const w = watch(dir, (_event, filename) => {
      if (!filename) return;
      const base = filename.toString();
      if (!TRAIN_EXT.test(base) || base.startsWith('_') || base.startsWith('.')) return;
      const name = parsePath(base).name;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(name, setTimeout(() => {
        timers.delete(name);
        onChange(name, join(dir, base));
      }, HOT_RELOAD_DEBOUNCE_MS));
    });
    w.on('error', err => log.warn({ err: errMsg(err) }, 'train hot-reload: watcher error'));
    log.info({ dir }, 'train hot-reload: watching');
    return w;
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'train hot-reload: watch unavailable (on-demand restart only)');
    return null;
  }
}

export function killGracefully(proc: ReturnType<typeof Bun.spawn> | null): Promise<unknown> | null {
  if (!proc || proc.exitCode !== null) return null;
  try { proc.kill('SIGTERM'); } catch { /* ignore */ }
  const grace = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, 2_000);
  return proc.exited.finally(() => clearTimeout(grace));
}

export async function pumpStream(
  stream: unknown, name: string, kind: 'stdout' | 'stderr', onChunk: (s: string) => void,
): Promise<void> {
  if (!stream || typeof stream === 'number') return;
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const dec = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk(dec.decode(value, { stream: true }));
    }
  } catch (err) { log.debug({ name, err: errMsg(err) }, `train: ${kind} pump ended`); }
}
