/** Per-line membership + permissions registry. Sidecar to claims.json. */

/** Lines absent from this file are membership-free (back-compat: behave like before). Lines
 *  present here are member-gated: identity-aware tail/state filters by `members[]`. */

import {
  closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { Line } from '../lines.js';

export const MEMBERS_FILE = join(STATE_DIR, 'members.json');
const MEMBERS_LOCK = join(STATE_DIR, 'members.json.lock');

export type Permission = 'read' | 'write' | 'admin';

export interface MembersEntry {
  members: Line[];
  /** Default per-member permission is `write`. Override per-URI here. */
  permissions?: Record<string, Permission>;
}

export type MembersMap = Record<string, MembersEntry>;

export function readMembers(): MembersMap {
  if (!existsSync(MEMBERS_FILE)) return {};
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return JSON.parse(readFileSync(MEMBERS_FILE, 'utf8')) as MembersMap; }
    catch { /* race with writer — retry once */ }
  }
  log.warn({ path: MEMBERS_FILE }, 'members: malformed, treating as empty');
  return {};
}

function withMembersLock<T>(fn: (m: MembersMap) => T): T {
  const deadline = Date.now() + 2_000;
  while (true) {
    try { closeSync(openSync(MEMBERS_LOCK, 'wx')); break; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('members.json: lock contention (held >2s)');
    }
  }
  try {
    const next = readMembers();
    const result = fn(next);
    const tmp = `${MEMBERS_FILE}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
    renameSync(tmp, MEMBERS_FILE);
    return result;
  } finally {
    try { unlinkSync(MEMBERS_LOCK); } catch { /* ignore */ }
  }
}

/** Replace the membership entry for `line` outright. */
export function setMembers(
  line: Line, members: Line[], permissions?: Record<string, Permission>,
): MembersMap {
  return withMembersLock(m => {
    const dedup = Array.from(new Set(members));
    m[line] = permissions ? { members: dedup, permissions } : { members: dedup };
    return m;
  });
}

/** Add URIs to `line`'s membership (creates the entry if missing). */
export function addMembers(line: Line, toAdd: Line[]): MembersMap {
  return withMembersLock(m => {
    const cur = m[line] ?? { members: [] };
    cur.members = Array.from(new Set([...cur.members, ...toAdd]));
    m[line] = cur;
    return m;
  });
}

/** Remove URIs from `line`'s membership. Drops the entry entirely if it empties out. */
export function removeMembers(line: Line, toRemove: Line[]): MembersMap {
  return withMembersLock(m => {
    const cur = m[line];
    if (!cur) return m;
    const drop = new Set(toRemove);
    cur.members = cur.members.filter(u => !drop.has(u));
    if (cur.permissions) {
      for (const u of toRemove) delete cur.permissions[u];
    }
    if (cur.members.length === 0) delete m[line];
    else m[line] = cur;
    return m;
  });
}

/** Drop the entire membership entry for `line` (back-compat: line becomes unrestricted). */
export function deleteMembership(line: Line): MembersMap {
  return withMembersLock(m => { delete m[line]; return m; });
}

/** True iff `line` has any membership entry. Lines without an entry are unrestricted. */
export function hasMembership(line: string, members?: MembersMap): boolean {
  const m = members ?? readMembers();
  return line in m;
}

/** True iff `uri` is a listed member of `line`. Returns true for unrestricted lines (no entry). */
export function isMember(line: string, uri: Line, members?: MembersMap): boolean {
  const m = members ?? readMembers();
  const entry = m[line];
  if (!entry) return true;
  return entry.members.includes(uri);
}

/** Permission for `uri` on `line`. Returns `null` if not a member; defaults to `write`. */
export function getPermission(line: string, uri: Line, members?: MembersMap): Permission | null {
  const m = members ?? readMembers();
  const entry = m[line];
  if (!entry) return 'write';  /** unrestricted line — anyone can write */
  if (!entry.members.includes(uri)) return null;
  return entry.permissions?.[uri] ?? 'write';
}
