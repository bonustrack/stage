/** Per-conversation composer drafts — persisted to a file + cached in-memory so
 *  the channels list can show a "draft" pen icon on rows with unsent text.
 *  Keyed by convId. */

import { useEffect, useReducer } from 'react';
import { Directory, File, Paths } from 'expo-file-system';

function draftsFile(): File {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, 'composer-drafts.json');
}

let drafts: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(l => l()); };

export async function loadDrafts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const f = draftsFile();
    if (f.exists) { const raw = await f.text(); drafts = raw ? JSON.parse(raw) : {}; }
  } catch { drafts = {}; }
  notify();
}

function persist(): void {
  try {
    const f = draftsFile();
    if (Object.keys(drafts).length) f.write(JSON.stringify(drafts));
    else if (f.exists) f.delete();
  } catch { /* best-effort */ }
}

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
