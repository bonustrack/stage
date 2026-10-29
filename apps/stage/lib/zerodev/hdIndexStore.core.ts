import { ignored } from '../errorPolicy';

interface IndexStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export function parseHdIndex(raw: string): number {
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 0)
    throw new Error('The saved wallet index is invalid. Nothing was changed.');
  return value;
}

export function makeHdIndexStore(storage: IndexStorage): {
  read: (key: string) => Promise<number | null>;
  reserve: (key: string, hdIndex: number) => Promise<void>;
} {
  let tail = Promise.resolve();
  const read = async (key: string): Promise<number | null> => {
    const raw = await storage.get(key);
    return raw === null ? null : parseHdIndex(raw);
  };
  return {
    read,
    reserve: (key, hdIndex) => {
      const pending = tail.then(async () => {
        if (!Number.isSafeInteger(hdIndex) || hdIndex < 0 || !Number.isSafeInteger(hdIndex + 1))
          throw new Error('The wallet index is invalid.');
        const current = await read(key);
        await storage.set(key, String(Math.max(current ?? 0, hdIndex + 1)));
      });
      tail = pending.catch(ignored(undefined, 'cleanup'));
      return pending;
    },
  };
}
