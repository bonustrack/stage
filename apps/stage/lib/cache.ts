import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { attempt, report } from './errorPolicy';
import { makeRecordStore, type RecordStore } from './recordStore';

const DIR_NAME = 'stage';

function appDocumentsDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function parsedJson(name: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    report(`cache.parse.${name}`, err);
    return null;
  }
}

function onFlushSignal(flushAll: () => void): void {
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') flushAll();
  });
}

export const persistenceBackend = {
  async read(name: string): Promise<unknown> {
    const f = new File(appDocumentsDir(), name);
    return f.exists ? parsedJson(name, await f.text()) : null;
  },
  write(name: string, value: unknown): void {
    attempt(() => {
      const f = new File(appDocumentsDir(), name);
      if (value === null) {
        if (f.exists) f.delete();
      } else f.write(JSON.stringify(value));
    }, 'cache');
  },
  onFlushSignal,
};

function recordFile(name: string): File {
  return new File(appDocumentsDir(), `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

async function readRecordFile(name: string): Promise<string | null> {
  const f = recordFile(name);
  return f.exists ? f.text() : null;
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
  return makeRecordStore(
    { read: readRecordFile, write: writeRecordFile, onFlushSignal },
    { delayMs: 1_500, maxWaitMs: 5_000 },
    writeErrorTag,
  );
}
