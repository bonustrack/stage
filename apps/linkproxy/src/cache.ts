/** Two-tier cache (in-memory + disk) for link-preview results.
 *
 *  Disk file lives at ~/.cache/metro/linkpreviews.json so it survives restarts
 *  and is shared across the proxy's lifetime. Entries carry a timestamp and are
 *  considered stale after {@link TTL_MS} (~1 day). Writes are debounced and the
 *  on-disk map is pruned of expired entries on load + on each flush so it can't
 *  grow unbounded. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { PreviewMeta } from './parse.ts';
import type { X402Challenge } from './x402.ts';

export const TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const MAX_ENTRIES = 5000;

const DIR = path.join(homedir(), '.cache', 'metro');
const FILE = path.join(DIR, 'linkpreviews.json');

/** What the proxy caches per URL: an OpenGraph preview or an x402 challenge. */
export type CachedResult = PreviewMeta | X402Challenge;

interface Entry { ts: number; data: CachedResult }

const mem = new Map<string, Entry>();
let loaded = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function fresh(e: Entry): boolean {
  return Date.now() - e.ts < TTL_MS;
}

/** Load the disk cache into memory once (idempotent). Corrupt/missing file = no-op. */
export async function loadCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await readFile(FILE, 'utf8');
    const obj = JSON.parse(raw) as Record<string, Entry>;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v.ts === 'number' && fresh(v)) mem.set(k, v);
    }
  } catch {
    /* no cache yet / unreadable — start empty */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 1000);
}

async function flush(): Promise<void> {
  // Prune expired + cap size (oldest-first) before persisting.
  for (const [k, v] of mem) if (!fresh(v)) mem.delete(k);
  if (mem.size > MAX_ENTRIES) {
    const sorted = [...mem.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (const [k] of sorted.slice(0, mem.size - MAX_ENTRIES)) mem.delete(k);
  }
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(Object.fromEntries(mem)), 'utf8');
  } catch {
    /* best-effort disk cache */
  }
}

/** Get a fresh cached entry for `url`, or undefined. */
export function getCached(url: string): CachedResult | undefined {
  const e = mem.get(url);
  if (!e) return undefined;
  if (!fresh(e)) { mem.delete(url); return undefined; }
  return e.data;
}

/** Store a result and schedule a debounced disk flush. */
export function setCached(url: string, data: CachedResult): void {
  mem.set(url, { ts: Date.now(), data });
  scheduleFlush();
}
