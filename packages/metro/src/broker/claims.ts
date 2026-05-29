/** Claims map: per-line owner registry under an O_EXCL lockfile. */

import {
  closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { log } from '../log.js';
import { HISTORY_FILE, STATE_DIR } from '../paths.js';
import { Line } from '../lines.js';

export const CLAIMS_FILE = join(STATE_DIR, 'claims.json');
const CLAIMS_LOCK = join(STATE_DIR, 'claims.json.lock');
/** Re-exported for the broker tail + tests; canonical definition lives in paths.ts. */
export { HISTORY_FILE };

export type ClaimsMap = Record<string, Line>;

/** Read claims.json. Returns empty map if missing or malformed (retries once on race). */
export function readClaims(): ClaimsMap {
  if (!existsSync(CLAIMS_FILE)) return {};
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')) as ClaimsMap; }
    catch { /* race with writer — retry once */ }
  }
  log.warn({ path: CLAIMS_FILE }, 'claims: malformed, treating as empty');
  return {};
}

/** Mutate claims under an O_EXCL lockfile. Throws if another writer holds the lock past timeout. */
function withClaimsLock<T>(fn: (m: ClaimsMap) => T): T {
  const deadline = Date.now() + 2_000;
  while (true) {
    try { closeSync(openSync(CLAIMS_LOCK, 'wx')); break; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('claims.json: lock contention (held >2s)');
    }
  }
  try {
    const next = readClaims();
    const result = fn(next);
    /** atomic publish: tmpfile + rename so readers never see a half-written file */
    const tmp = `${CLAIMS_FILE}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
    renameSync(tmp, CLAIMS_FILE);
    return result;
  } finally {
    try { unlinkSync(CLAIMS_LOCK); } catch { /* ignore */ }
  }
}

export function claimLine(line: Line, owner: Line): ClaimsMap {
  return withClaimsLock(m => { m[line] = owner; return m; });
}

export function releaseLine(line: Line): { released: boolean; claims: ClaimsMap } {
  return withClaimsLock(m => {
    const released = line in m;
    delete m[line];
    return { released, claims: m };
  });
}
