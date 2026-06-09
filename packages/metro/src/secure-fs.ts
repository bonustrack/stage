/** Secure-fs helpers: enforce 0600 on credential files + 0700 on ~/.metro,
 *  idempotently. chmod changes MODE only, never CONTENT (behavior-preserving). */

import {
  chmodSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Canonical credential directory. Trains read accounts/mnemonic from here. */
export const METRO_HOME = process.env.METRO_HOME_DIR ?? join(homedir(), '.metro');

/** Ensure a directory exists with 0700 perms (idempotent). */
export function ensureSecureDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // mkdirSync mode is masked by umask + skipped if the dir already exists;
  // force-tighten an existing dir to 0700.
  try { chmodSync(dir, 0o700); } catch { /* not ours / not present — best effort */ }
}

/** Tighten an existing file to 0600 if present. No-op when absent. MODE only —
 *  never reads or rewrites CONTENT. Idempotent and best-effort. */
export function chmodIfExists(path: string, mode = 0o600): void {
  if (!existsSync(path)) return;
  try {
    if ((statSync(path).mode & 0o777) !== mode) chmodSync(path, mode);
  } catch { /* best effort */ }
}

/** Atomically write a credential file with 0600 perms, creating the parent
 *  directory at 0700. Writes to a temp sibling then renames so a crash can't
 *  leave a partially-written (or briefly world-readable) credential file. */
export function writeSecure(path: string, data: string): void {
  ensureSecureDir(dirname(path));
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, data, { mode: 0o600 });
  try { chmodSync(tmp, 0o600); } catch { /* mode arg above already covers it */ }
  renameSync(tmp, path);
  chmodIfExists(path, 0o600);
}
