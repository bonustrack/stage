import { AppState } from 'react-native';
import { File } from 'expo-file-system';
import { appDocumentsDir } from './appDocuments';
import { attempt } from './errorPolicy';

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
