
import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

const PERSIST_DEBOUNCE_MS = 800;

function draftsFile(): File {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, 'composer-drafts.json');
}

function parseDrafts(raw: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

let drafts: Record<string, string> = {};
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(l => { l(); }); };

export async function loadDrafts(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async (): Promise<void> => {
    try {
      const f = draftsFile();
      if (f.exists) { const raw = await f.text(); drafts = raw ? parseDrafts(raw) : {}; }
    } catch { drafts = {}; }
    loaded = true;
    loading = null;
    notify();
  })();
  return loading;
}

function writeToDisk(): void {
  persistTimer = null;
  dirty = false;
  try {
    const f = draftsFile();
    if (Object.keys(drafts).length) f.write(JSON.stringify(drafts));
    else if (f.exists) f.delete();
  } catch { }
}

let persistTimer: number | null = null;
let dirty = false;

function persist(): void {
  dirty = true;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(writeToDisk, PERSIST_DEBOUNCE_MS) as unknown as number;
}

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
  if (t) drafts[convId] = t; else Reflect.deleteProperty(drafts, convId);
  persist();
  notify();
}

export function useDraftsVersion(): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    void loadDrafts();
    const fn = (): void => { bump(); };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return version;
}
