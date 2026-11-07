import { Directory, File, Paths } from 'expo-file-system';
import type { XmtpEnv } from './xmtp.types';
import { z } from 'zod';
import { report, attempt } from './errorPolicy';
import { jsonWith } from './storeCore';

interface PushAccount {
  id: string;
  address: string;
  inboxId: string;
  dbDir: string;
  env: XmtpEnv;
}

const MANIFEST_NAME = 'stage-push-accounts.json';

function firstAppGroup(): [string, Directory] | null {
  try {
    return Object.entries(Paths.appleSharedContainers)[0] ?? null;
  } catch {
    return null;
  }
}

const SHARED = firstAppGroup();

export const XMTP_APP_GROUP: string | null = SHARED ? SHARED[0] : null;

const SHARED_ROOT: Directory | null = SHARED ? SHARED[1] : null;

function isPushAccount(value: unknown): value is PushAccount {
  const { id, address, inboxId, dbDir, env } = (value ?? {}) as Partial<Record<keyof PushAccount, unknown>>;
  return [id, address, inboxId, dbDir, env].every((field) => typeof field === 'string');
}

const manifestJson = jsonWith(z.array(z.unknown()).transform((items) => items.filter(isPushAccount)));

function manifestFile(): File | null {
  return SHARED_ROOT ? new File(SHARED_ROOT, MANIFEST_NAME) : null;
}

function readManifest(file: File): PushAccount[] {
  try {
    return file.exists ? (manifestJson(file.textSync()) ?? []) : [];
  } catch {
    return [];
  }
}

function writeManifest(file: File, accounts: PushAccount[]): void {
  try {
    file.write(JSON.stringify(accounts));
  } catch (err) {
    report('xmtp.pushManifest', err);
  }
}

export function recordPushAccount(account: PushAccount): void {
  const file = manifestFile();
  if (!file) return;
  const others = readManifest(file).filter((a) => a.id !== account.id);
  writeManifest(file, [account, ...others]);
}

export function forgetPushAccount(accountId: string): void {
  const file = manifestFile();
  if (!file) return;
  const others = readManifest(file).filter((a) => a.id !== accountId);
  writeManifest(file, others);
}

function removeDir(dir: Directory): void {
  try {
    dir.delete();
  } catch (err) {
    report('xmtp.deleteDbFiles', err);
    attempt(() => {
      for (const entry of dir.list()) {
        if (entry instanceof File)
          attempt(() => {
            entry.delete();
          }, 'cleanup');
      }
    }, 'cleanup');
    attempt(() => {
      dir.delete();
    }, 'cleanup');
  }
}

export function deleteDbFiles(dbDirName: string): Promise<void> {
  const dir = dbDirObj(dbDirName);
  if (dir.exists) removeDir(dir);
  attempt(() => {
    dbDirObj(dbDirName).create({ intermediates: true });
  }, 'cleanup');
  return Promise.resolve();
}

function dbDirObj(name: string): Directory {
  return new Directory(SHARED_ROOT ?? Paths.document, name);
}

export function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  if (!dir.exists) dir.create({ intermediates: true });
  const path = toFsPath(dir);
  if (__DEV__) assertWritableDir(dir, path);
  return Promise.resolve(path);
}

function toFsPath(dir: Directory): string {
  const decoded = (() => {
    try {
      return decodeURI(dir.uri);
    } catch {
      return dir.uri;
    }
  })();
  return (
    '/' +
    decoded
      .replace(/^file:\/+/i, '')
      .replace(/\/{2,}/g, '/')
      .replace(/\/+$/, '')
  );
}

function assertWritableDir(dir: Directory, path: string): void {
  try {
    const probe = new File(dir, '.xmtp_write_probe');
    probe.write('1');
    const ok = probe.exists;
    attempt(() => {
      probe.delete();
    }, 'cleanup');
    console.log(`[xmtp] dbDirectory ready path=${path} exists=${dir.exists} writable=${ok}`);
  } catch (e) {
    console.warn(`[xmtp] dbDirectory NOT writable path=${path} exists=${dir.exists} err=${String(e)}`);
  }
}
