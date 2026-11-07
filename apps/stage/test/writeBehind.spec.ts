import { afterEach, beforeEach, describe, expect, jest, setSystemTime, test } from 'bun:test';
import { writeBehind } from '../lib/writeBehind';
import { makeRecordStore } from '../lib/recordStore';

const START = 1_000_000;

async function advance(ms: number): Promise<void> {
  setSystemTime(Date.now() + ms);
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  setSystemTime(START);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  setSystemTime();
});

describe('write behind', () => {
  test('a debounced key writes its latest value once the writes pause', async () => {
    const written: string[] = [];
    const writes = writeBehind<string>({ delayMs: 100 }, (key, value) => written.push(`${key}=${value}`));
    writes.set('a', '1');
    await advance(60);
    writes.set('a', '2');
    await advance(60);
    expect(written).toEqual([]);
    expect(writes.peek('a')).toEqual({ value: '2' });
    await advance(40);
    expect(written).toEqual(['a=2']);
    expect(writes.peek('a')).toBeUndefined();
  });

  test('a throttled key writes on the first deadline however often it changes', async () => {
    const written: string[] = [];
    const writes = writeBehind<string>({ delayMs: 100, restart: false }, (key, value) => written.push(`${key}=${value}`));
    writes.set('a', '1');
    await advance(60);
    writes.set('a', '2');
    await advance(40);
    expect(written).toEqual(['a=2']);
  });

  test('a long quiet key writes at once, then debounces until the wait is over again', async () => {
    const written: string[] = [];
    const writes = writeBehind<string>({ delayMs: 100, maxWaitMs: 1_000 }, (key, value) => written.push(`${key}=${value}`));
    writes.set('a', '1');
    writes.set('a', '2');
    expect(written).toEqual(['a=1']);
    await advance(100);
    expect(written).toEqual(['a=1', 'a=2']);
    await advance(1_000);
    writes.set('a', '3');
    expect(written).toEqual(['a=1', 'a=2', 'a=3']);
  });

  test('flush writes a pending key now and drop forgets it', async () => {
    const written: string[] = [];
    const writes = writeBehind<string>({ delayMs: 100 }, (key, value) => written.push(`${key}=${value}`));
    writes.set('a', '1');
    writes.set('b', '1');
    expect(writes.flush('a')).toBe(true);
    expect(writes.flush('a')).toBe(false);
    writes.drop('b');
    await advance(100);
    expect(written).toEqual(['a=1']);
  });
});

describe('record store', () => {
  function memoryRecords() {
    const files = new Map<string, string>();
    const writeGate = { open: Promise.resolve() };
    let flushAll = (): void => undefined;
    const store = makeRecordStore(
      {
        read: async (name) => files.get(name) ?? null,
        write: async (name, text) => {
          await writeGate.open;
          if (text === null) files.delete(name);
          else files.set(name, text);
        },
        onFlushSignal: (flush) => {
          flushAll = flush;
        },
      },
      { delayMs: 100 },
      'test.records',
    );
    return { files, writeGate, store, flush: () => flushAll() };
  }

  test('a read sees a pending write before it reaches storage', async () => {
    const { files, store } = memoryRecords();
    files.set('r', 'stored');
    store.write('r', () => 'pending');
    expect(await store.read('r')).toBe('pending');
    expect(files.get('r')).toBe('stored');
    await advance(100);
    expect(files.get('r')).toBe('pending');
    expect(await store.read('r')).toBe('pending');
  });

  test('a read during a slow write returns the text being written', async () => {
    const { files, writeGate, store, flush } = memoryRecords();
    files.set('r', 'stored');
    const gate = Promise.withResolvers<undefined>();
    writeGate.open = gate.promise;
    store.write('r', () => 'written');
    flush();
    expect(await store.read('r')).toBe('written');
    gate.resolve(undefined);
    await advance(0);
    expect(files.get('r')).toBe('written');
  });

  test('remove drops a pending write and deletes the stored record', async () => {
    const { files, store } = memoryRecords();
    files.set('r', 'stored');
    store.write('r', () => 'pending');
    await store.remove('r');
    await advance(100);
    expect(files.has('r')).toBe(false);
    expect(await store.read('r')).toBeNull();
  });
});
