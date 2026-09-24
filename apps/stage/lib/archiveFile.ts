import { File, Paths } from 'expo-file-system';
import { attempt } from './errorPolicy';

let sequence = 0;

function scratchArchive(): File {
  sequence += 1;
  const file = new File(Paths.cache, `history-transfer-${Date.now()}-${sequence}.bin`);
  if (file.exists) file.delete();
  return file;
}

function fsPathOf(file: File): string {
  const decoded = (() => { try { return decodeURI(file.uri); } catch { return file.uri; } })();
  return '/' + decoded.replace(/^file:\/+/i, '').replace(/\/{2,}/g, '/');
}

async function withScratchArchive<T>(work: (file: File, path: string) => Promise<T>): Promise<T> {
  const file = scratchArchive();
  try {
    return await work(file, fsPathOf(file));
  } finally {
    attempt(() => { if (file.exists) file.delete(); }, 'cleanup');
  }
}

export function archiveToBytes(create: (path: string) => Promise<unknown>): Promise<Uint8Array> {
  return withScratchArchive(async (file, path) => {
    await create(path);
    return file.bytes();
  });
}

export function archiveFromBytes(archive: Uint8Array, use: (path: string) => Promise<unknown>): Promise<void> {
  return withScratchArchive(async (file, path) => {
    file.create();
    file.write(archive);
    await use(path);
  });
}
