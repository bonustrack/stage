import type { ArchiveNamespace, ArchiveStorage } from '../src/historyStore.ts';
import type { MailStorage } from '../src/mailBox.ts';

export type MemoryStorage = ArchiveStorage & MailStorage & { alarm: number | null; data: Map<string, unknown> };

type ObjectFetch = (request: Request, storage: ArchiveStorage, now: number) => Promise<Response>;

export function memoryStorage(): MemoryStorage {
  const data = new Map<string, unknown>();
  return {
    data,
    alarm: null,
    get: (keys) => Promise.resolve(new Map(keys.filter((key) => data.has(key)).map((key) => [key, data.get(key)]))),
    put(entries: Record<string, unknown>) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
      return Promise.resolve();
    },
    delete: (keys) => Promise.resolve(keys.filter((key) => data.delete(key)).length),
    list: ({ prefix }) => Promise.resolve(new Map([...data].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)))),
    setAlarm(time) {
      this.alarm = time;
      return Promise.resolve();
    },
    deleteAll() {
      data.clear();
      return Promise.resolve();
    },
  };
}

export function memoryNamespace(
  objectFetch: ObjectFetch, now: number,
): ArchiveNamespace<string> & { objects: Map<string, MemoryStorage> } {
  const objects = new Map<string, MemoryStorage>();
  return {
    objects,
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (input, init) => {
        const storage = objects.get(id) ?? memoryStorage();
        objects.set(id, storage);
        return objectFetch(new Request(input, init), storage, now);
      },
    }),
  };
}
