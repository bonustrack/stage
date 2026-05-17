/** Dynamic-import `~/.metro/adapters/<station>/map.ts`. Re-imports on mtime change (cache-bust via `?v=<mtime>`). */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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

type CacheEntry = { mtimeMs: number; fn: MapFn };
const cache = new Map<string, CacheEntry>();

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

/** Load `map` for `station`. Re-imports when the file's mtime changes — hot-reload without watchers. */
export async function loadAdapter(station: string): Promise<MapFn> {
  const path = mapFile(station);
  if (!existsSync(path)) throw new Error(`missing adapter ${path}`);
  const mtimeMs = statSync(path).mtimeMs;
  const hit = cache.get(station);
  if (hit && hit.mtimeMs === mtimeMs) return hit.fn;
  const url = `${pathToFileURL(path).href}?v=${mtimeMs}`;
  const mod = await import(url) as { map?: unknown };
  if (typeof mod.map !== 'function') {
    throw new Error(`${path} must export a \`map\` function`);
  }
  const fn = mod.map as MapFn;
  cache.set(station, { mtimeMs, fn });
  return fn;
}
