
import { Directory, File, Paths } from 'expo-file-system';
import { sharedStoreRoot } from './xmtp.appGroup';
import { report, attempt } from './errorPolicy';

function removeDir(dir: Directory): void {
  try {
    dir.delete();
  } catch (err) {
    report('xmtp.deleteDbFiles', err);
    attempt(() => {
      for (const entry of dir.list()) {
        if (entry instanceof File) attempt(() => { entry.delete(); }, 'cleanup');
      }
    }, 'cleanup');
    attempt(() => { dir.delete(); }, 'cleanup');
  }
}

export function deleteDbFiles(dbDirName: string): Promise<void> {
  const dir = dbDirObj(dbDirName);
  if (dir.exists) removeDir(dir);
  attempt(() => { dbDirObj(dbDirName).create({ intermediates: true }); }, 'cleanup');
  return Promise.resolve();
}

function dbDirObj(name: string): Directory { return new Directory(sharedStoreRoot() ?? Paths.document, name); }

export function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  if (!dir.exists) dir.create({ intermediates: true });
  const path = toFsPath(dir);
  if (__DEV__) assertWritableDir(dir, path);
  return Promise.resolve(path);
}

function toFsPath(dir: Directory): string {
  const decoded = (() => { try { return decodeURI(dir.uri); } catch { return dir.uri; } })();
  return '/' + decoded
    .replace(/^file:\/+/i, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
}

function assertWritableDir(dir: Directory, path: string): void {
  try {
    const probe = new File(dir, '.xmtp_write_probe');
    probe.write('1');
    const ok = probe.exists;
    attempt(() => { probe.delete(); }, 'cleanup');
    console.log(`[xmtp] dbDirectory ready path=${path} exists=${dir.exists} writable=${ok}`);
  } catch (e) {
    console.warn(`[xmtp] dbDirectory NOT writable path=${path} exists=${dir.exists} err=${String(e)}`);
  }
}
