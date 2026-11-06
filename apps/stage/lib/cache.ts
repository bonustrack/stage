import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { attempt, reported } from './errorPolicy';

const DIR_NAME = 'stage';

function appDocumentsDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export const persistenceBackend = {
  async read<T>(name: string): Promise<T | null> {
    try {
      const f = new File(appDocumentsDir(), name);
      return f.exists ? (JSON.parse(await f.text()) as T) : null;
    } catch {
      return null;
    }
  },
  write(name: string, value: unknown): void {
    attempt(() => {
      const f = new File(appDocumentsDir(), name);
      if (value === null) {
        if (f.exists) f.delete();
      } else f.write(JSON.stringify(value));
    }, 'cache');
  },
  onFlushSignal(flushAll: () => void): void {
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushAll();
    });
  },
};

interface SealedCache {
  read(name: string): Promise<string | null>;
  write(name: string, text: string | null): Promise<void>;
}

export const sealedCache: SealedCache | null = null;

export interface RecordStore {
  read(name: string): Promise<string | null>;
  write(name: string, text: () => string | Promise<string>): void;
  remove(name: string): Promise<void>;
}

const RECORD_DEBOUNCE_MS = 1_500;
const RECORD_FLUSH_MS = 5_000;

function recordFile(name: string): File {
  return new File(appDocumentsDir(), `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

async function readRecordFile(name: string): Promise<string | null> {
  try {
    const f = recordFile(name);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

function writeRecordFile(name: string, text: string | null): void {
  attempt(() => {
    const f = recordFile(name);
    if (text === null) {
      if (f.exists) f.delete();
    } else f.write(text);
  }, 'cache');
}

export function createRecordStore(writeErrorTag: string): RecordStore {
  const texts = new Map<string, () => string | Promise<string>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const dirty = new Set<string>();
  const flushedAt = new Map<string, number>();
  function writeNow(name: string): void {
    clearTimeout(timers.get(name));
    timers.delete(name);
    const text = texts.get(name);
    if (!dirty.has(name) || text === undefined) return;
    dirty.delete(name);
    const value = text();
    if (typeof value === 'string') writeRecordFile(name, value);
    else
      void value
        .then((resolved) => {
          writeRecordFile(name, resolved);
        })
        .catch(reported(writeErrorTag));
  }
  persistenceBackend.onFlushSignal(() => {
    for (const name of [...dirty]) writeNow(name);
  });
  return {
    async read(name) {
      const pending = texts.get(name);
      if (pending !== undefined) return pending();
      const stored = await readRecordFile(name);
      const written = texts.get(name);
      return written === undefined ? stored : written();
    },
    write(name, text) {
      texts.set(name, text);
      dirty.add(name);
      clearTimeout(timers.get(name));
      timers.set(
        name,
        setTimeout(() => {
          writeNow(name);
        }, RECORD_DEBOUNCE_MS),
      );
      const now = Date.now();
      if (now - (flushedAt.get(name) ?? 0) < RECORD_FLUSH_MS) return;
      flushedAt.set(name, now);
      writeNow(name);
    },
    remove(name) {
      clearTimeout(timers.get(name));
      timers.delete(name);
      texts.delete(name);
      dirty.delete(name);
      writeRecordFile(name, null);
      return Promise.resolve();
    },
  };
}
