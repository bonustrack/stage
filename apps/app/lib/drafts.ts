/** Per-conversation composer drafts — persisted to a file + cached in-memory so
 *  the channels list can show a "draft" pen icon on rows with unsent text.
 *  Keyed by convId. */

import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/** Trailing flush window for the debounced disk write. setDraft() fires once per
 *  keystroke; coalescing the SYNCHRONOUS file write to one pass per window keeps
 *  the composer from janking on every character. */
const PERSIST_DEBOUNCE_MS = 800;

function draftsFile(): File {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, 'composer-drafts.json');
}

let drafts: Record<string, string> = {};
let loaded = false;
/** In-flight load promise, memoized so two concurrent boot callers await the
 *  SAME disk read. Previously `loaded` flipped true before `await f.text()`
 *  resolved, so a second caller saw an empty `drafts` map mid-read. */
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(l => l()); };

export async function loadDrafts(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async (): Promise<void> => {
    try {
      const f = draftsFile();
      if (f.exists) { const raw = await f.text(); drafts = raw ? JSON.parse(raw) : {}; }
    } catch { drafts = {}; }
    // Mark loaded only AFTER the read resolves, so the sync fast path can't
    // observe loaded===true with an empty in-memory map.
    loaded = true;
    loading = null;
    notify();
  })();
  return loading;
}

/** Synchronous write of the current in-memory drafts to disk (or delete when
 *  empty). Clears the dirty flag. */
function writeToDisk(): void {
  persistTimer = null;
  dirty = false;
  try {
    const f = draftsFile();
    if (Object.keys(drafts).length) f.write(JSON.stringify(drafts));
    else if (f.exists) f.delete();
  } catch { /* best-effort */ }
}

/** RN timer id for the trailing flush. `number` to avoid the @types/node
 *  Timeout collision the Railgun SDK introduces. */
let persistTimer: number | null = null;
/** True when in-memory drafts differ from disk (a keystroke landed but the
 *  debounced flush hasn't run yet). */
let dirty = false;

/** Debounced persist: mark dirty + (re)arm the trailing flush so a burst of
 *  keystrokes collapses to one synchronous write per window. */
function persist(): void {
  dirty = true;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(writeToDisk, PERSIST_DEBOUNCE_MS) as unknown as number;
}

/** Flush a pending debounced write on the way to background/inactive so a
 *  process kill can't drop the last keystroke. */
AppState.addEventListener('change', (state) => {
  if (state === 'active') return;
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (dirty) writeToDisk();
});

export function getDraft(convId: string): string { return drafts[convId] ?? ''; }
export function hasDraft(convId?: string | null): boolean {
  return !!convId && !!(drafts[convId] ?? '').trim();
}
export function setDraft(convId: string, text: string): void {
  const t = text.trim() ? text : '';
  if (t) drafts[convId] = t; else delete drafts[convId];
  persist();
  notify();
}

/** Re-render + load on mount; returns a version counter for FlatList extraData. */
export function useDraftsVersion(): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    void loadDrafts();
    const fn = (): void => bump();
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return version;
}
