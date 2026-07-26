
import { Directory, File, Paths } from 'expo-file-system';

export function deleteDbFiles(dbDirName: string): void {
  const dir = dbDirObj(dbDirName);
  if (!dir.exists) {
    try { dir.create({ intermediates: true }); } catch { }
    return;
  }
  try {
    dir.delete();
  } catch {
    try {
      for (const entry of dir.list()) {
        if (entry instanceof File) { try { entry.delete(); } catch { } }
      }
    } catch { }
    try { dir.delete(); } catch { }
  }
  try { dbDirObj(dbDirName).create({ intermediates: true }); } catch { }
}

function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

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
    try { probe.delete(); } catch { }
    console.log(`[xmtp] dbDirectory ready path=${path} exists=${dir.exists} writable=${ok}`);
  } catch (e) {
    console.warn(`[xmtp] dbDirectory NOT writable path=${path} exists=${dir.exists} err=${String(e)}`);
  }
}
