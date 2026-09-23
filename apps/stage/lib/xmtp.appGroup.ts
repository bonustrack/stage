import { Directory, File, Paths } from 'expo-file-system';
import type { XmtpEnv } from './xmtp.types';

export interface PushAccount {
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

export function sharedStoreRoot(): Directory | null {
  return SHARED ? SHARED[1] : null;
}

function isPushAccount(value: unknown): value is PushAccount {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.address === 'string' && typeof v.inboxId === 'string'
    && typeof v.dbDir === 'string' && typeof v.env === 'string';
}

function manifestFile(): File | null {
  const root = sharedStoreRoot();
  return root ? new File(root, MANIFEST_NAME) : null;
}

function readManifest(file: File): PushAccount[] {
  try {
    if (!file.exists) return [];
    const parsed: unknown = JSON.parse(file.textSync());
    return Array.isArray(parsed) ? parsed.filter(isPushAccount) : [];
  } catch {
    return [];
  }
}

function writeManifest(file: File, accounts: PushAccount[]): void {
  try { file.write(JSON.stringify(accounts)); } catch { }
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
  writeManifest(file, readManifest(file).filter((a) => a.id !== accountId));
}
