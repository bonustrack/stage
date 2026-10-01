
import { useEffect, useReducer } from 'react';
import { PersistentStore } from './cache.shared';

const PERSIST_DEBOUNCE_MS = 800;

const store = new PersistentStore<Record<string, unknown>>('composer-drafts.json', true, PERSIST_DEBOUNCE_MS);

export async function loadDrafts(): Promise<void> {
  await store.hydrate();
}

export function getDraftValue(key: string): unknown {
  return store.get()?.[key];
}

export function getDraft(convId: string): string {
  const draft = getDraftValue(convId);
  return typeof draft === 'string' ? draft : '';
}

export function hasDraft(convId?: string | null): boolean {
  return !!convId && !!getDraft(convId).trim();
}

export function setDraftValue(key: string, value: unknown): void {
  const next = { ...store.get() };
  if (value === undefined) Reflect.deleteProperty(next, key); else next[key] = value;
  store.set(Object.keys(next).length ? next : null);
}

export function setDraft(convId: string, text: string): void {
  setDraftValue(convId, text.trim() ? text : undefined);
}

export function useDraftsVersion(): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    void loadDrafts();
    return store.subscribe(() => { bump(); });
  }, []);
  return version;
}
