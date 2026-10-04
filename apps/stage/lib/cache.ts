import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { attempt } from './errorPolicy';

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
    } catch { return null; }
  },
  write(name: string, value: unknown): void {
    attempt(() => {
      const f = new File(appDocumentsDir(), name);
      if (value === null) { if (f.exists) f.delete(); }
      else f.write(JSON.stringify(value));
    }, 'cache');
  },
  onFlushSignal(flushAll: () => void): void {
    AppState.addEventListener('change', (state) => { if (state !== 'active') flushAll(); });
  },
};

interface SealedCache {
  read(name: string): Promise<string | null>;
  write(name: string, text: string | null): Promise<void>;
}

export const sealedCache: SealedCache | null = null;
