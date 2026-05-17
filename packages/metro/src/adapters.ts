/** Dynamic-import `~/.metro/adapters/<station>/map.ts`. Hot-reload on fs.watch + cache-bust via `?v=<mtime>`. */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { errMsg, log } from './log.js';
import { invoke } from './invoke.js';
import type { RawEvent } from './transports/index.js';

export const ADAPTERS_DIR = process.env.METRO_ADAPTERS_DIR ?? join(homedir(), '.metro', 'adapters');

/** The `metro` object passed to every `map()` — just enough to make a follow-up API call. */
export type Metro = { invoke: typeof invoke; log: typeof log };
export const metro: Metro = { invoke, log };

/** Partial inbound envelope returned by `map()`. The dispatcher fills `id`, `ts`, history wiring. */
export type Envelope = {
  /** `'inbound' | 'react' | 'http' | …`. Defaults to `'inbound'` if omitted. */
  kind?: string;
  line: string;
  lineName?: string;
  from: string;
  fromName?: string;
  to?: string;
  messageId?: string;
  text?: string;
  emoji?: string;
  isPrivate?: boolean;
};

export type MapFn = (raw: RawEvent, m: Metro) => Envelope | null | Promise<Envelope | null>;

type Slot = { promise: Promise<MapFn>; watcher: FSWatcher | null };
const cache = new Map<string, Slot>();

/** Repo-side templates dir — `<package-root>/adapters/`, resolved relative to compiled `dist/cli/`. */
function templatesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'adapters');
}

/** Copy templates → `~/.metro/adapters/<station>/map.ts` for any missing file. Idempotent. */
export function installTemplates(): { copied: string[] } {
  const src = templatesDir();
  const copied: string[] = [];
  if (!existsSync(src)) return { copied };
  mkdirSync(ADAPTERS_DIR, { recursive: true });
  for (const station of readdirSync(src)) {
    const srcStation = join(src, station);
    try { if (!statSync(srcStation).isDirectory()) continue; } catch { continue; }
    const dstStation = join(ADAPTERS_DIR, station);
    mkdirSync(dstStation, { recursive: true });
    for (const file of readdirSync(srcStation)) {
      const dst = join(dstStation, file);
      if (existsSync(dst)) continue;
      try { copyFileSync(join(srcStation, file), dst); copied.push(dst); }
      catch (err) { log.warn({ err: errMsg(err), dst }, 'adapter template copy failed'); }
    }
  }
  return { copied };
}

function mapFile(station: string): string {
  return join(ADAPTERS_DIR, station, 'map.ts');
}

async function importMap(station: string): Promise<MapFn> {
  const path = mapFile(station);
  if (!existsSync(path)) {
    throw new Error(`missing adapter ${path} — run \`metro adapters install\``);
  }
  /** Cache-bust each load so edits to map.ts take effect without restarting the daemon. Bun honours `?v=`. */
  const url = `${pathToFileURL(path).href}?v=${Date.now()}`;
  const mod = await import(url) as { map?: unknown };
  if (typeof mod.map !== 'function') {
    throw new Error(`${path} must export a \`map\` function`);
  }
  return mod.map as MapFn;
}

/** Load (and cache) the `map` function for `station`. Watches the directory; reloads on change. */
export function loadAdapter(station: string): Promise<MapFn> {
  const hit = cache.get(station);
  if (hit) return hit.promise;
  const promise = importMap(station);
  const slot: Slot = { promise, watcher: null };
  cache.set(station, slot);
  const dir = join(ADAPTERS_DIR, station);
  if (existsSync(dir)) {
    try {
      slot.watcher = watch(dir, { persistent: false }, () => {
        log.info({ station }, 'adapter changed; reloading on next event');
        slot.watcher?.close();
        cache.delete(station);
      });
    } catch (err) { log.warn({ err: errMsg(err), dir }, 'adapter watch failed'); }
  }
  return promise;
}

/** Drop the cached adapter for `station`. Used by tests + `metro adapters reload`. */
export function invalidateAdapter(station: string): void {
  const s = cache.get(station);
  s?.watcher?.close();
  cache.delete(station);
}

export function listAdapters(): { station: string; map: boolean; path: string }[] {
  if (!existsSync(ADAPTERS_DIR)) return [];
  return readdirSync(ADAPTERS_DIR)
    .filter(d => { try { return statSync(join(ADAPTERS_DIR, d)).isDirectory(); } catch { return false; } })
    .map(station => ({ station, map: existsSync(mapFile(station)), path: mapFile(station) }));
}
