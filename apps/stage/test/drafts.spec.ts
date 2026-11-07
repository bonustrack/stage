import { describe, expect, mock, test } from 'bun:test';
import { z } from 'zod';
import { mockAppStorage } from './memoryStorage';

const files = new Map<string, unknown>();
const written: string[] = [];
let readGate: Promise<void> = Promise.resolve();
let failedReads = 0;
let flushAll = (): void => undefined;

mockAppStorage();
mock.module('../lib/cache', () => ({
  persistenceBackend: {
    read: async (name: string) => {
      await readGate;
      if (failedReads > 0) {
        failedReads -= 1;
        throw new Error('disk unavailable');
      }
      return files.get(name) ?? null;
    },
    write: (name: string, value: unknown) => {
      written.push(name);
      files.set(name, value);
    },
    onFlushSignal: (flush: () => void) => {
      flushAll = flush;
    },
  },
}));

const { PersistentStore } = await import('../lib/cache.shared');
const { valueWith } = await import('../lib/storeCore');
const { getDraft, loadDrafts, setDraft } = await import('../lib/drafts');

describe('composer drafts', () => {
  test('a keystroke before the drafts load keeps every saved draft', async () => {
    files.set('composer-drafts.json', { a: 'saved a', b: 'saved b' });
    const gate = Promise.withResolvers<undefined>();
    readGate = gate.promise;
    setDraft('c', 'typing');
    expect(getDraft('c')).toBe('typing');
    gate.resolve(undefined);
    await loadDrafts();
    expect([getDraft('a'), getDraft('b'), getDraft('c')]).toEqual(['saved a', 'saved b', 'typing']);
    flushAll();
    expect(files.get('composer-drafts.json')).toEqual({ a: 'saved a', b: 'saved b', c: 'typing' });
  });
});

describe('persistent store', () => {
  const numbers = valueWith(z.record(z.number()));

  test('an edit after a failed read is not written until the stored value can be read', async () => {
    readGate = Promise.resolve();
    files.set('counts.json', { a: 1 });
    failedReads = 1;
    const store = new PersistentStore<Record<string, number>>('counts.json', { parse: numbers });
    store.update((current) => ({ ...current, b: 2 }));
    expect(await store.hydrate()).toEqual({ b: 2 });
    flushAll();
    expect(written).not.toContain('counts.json');
    expect(await store.hydrate()).toEqual({ a: 1, b: 2 });
    flushAll();
    expect(files.get('counts.json')).toEqual({ a: 1, b: 2 });
  });

  test('a value that fails its schema reads as absent', async () => {
    files.set('broken.json', { a: 'one' });
    const store = new PersistentStore<Record<string, number>>('broken.json', { parse: numbers });
    expect(await store.hydrate()).toBeNull();
    store.update((current) => ({ ...current, b: 2 }));
    expect(store.get()).toEqual({ b: 2 });
  });
});
