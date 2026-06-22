
const STORAGE_KEY = 'metro.channels.archived';

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as string[] : [];
    cache = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function write(next: Set<string>): void {
  cache = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); }
  catch { }
  for (const cb of listeners) cb();
}

export function loadArchivedIds(): Set<string> {
  return new Set(read());
}

export function isArchived(id: string): boolean {
  return read().has(id);
}

export function toggleArchived(id: string): Set<string> {
  const next = new Set(read());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  write(next);
  return new Set(next);
}

export function subscribeArchived(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
