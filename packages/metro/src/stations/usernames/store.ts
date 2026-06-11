// Flat-file JSON store for Stage username records, keyed by label.
//
// One file at $METRO_USERNAMES_FILE (default ~/.cache/metro/usernames.json),
// shaped `{ "<name>": UsernameRecord }`. First-come ownership: a name can only
// be claimed once. A reverse index (address → name) is built in memory on load
// so peer-profile reverse lookups are O(1). Writes are atomic (temp + rename)
// and serialized through a single in-flight promise so concurrent claims can't
// interleave and clobber the file.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { UsernameRecord } from './username-spec.js';

const FILE = process.env.METRO_USERNAMES_FILE
  ?? join(homedir(), '.cache', 'metro', 'usernames.json');

type Db = Record<string, UsernameRecord>;

let cache: Db | null = null;
/** address (lower-case) → name, derived from `cache`. */
const reverse = new Map<string, string>();
/** Serializes writes so two concurrent claims can't race the file. */
let writeChain: Promise<void> = Promise.resolve();

function rebuildReverse(db: Db): void {
  reverse.clear();
  for (const [name, rec] of Object.entries(db)) reverse.set(rec.address.toLowerCase(), name);
}

async function load(): Promise<Db> {
  if (cache) return cache;
  try {
    const raw = await readFile(FILE, 'utf8');
    cache = JSON.parse(raw) as Db;
  } catch {
    cache = {};
  }
  rebuildReverse(cache);
  return cache;
}

async function persist(db: Db): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, FILE);
}

/** Get the record for a label, or null. */
export async function getByName(name: string): Promise<UsernameRecord | null> {
  const db = await load();
  return db[name] ?? null;
}

/** Reverse lookup: the record claimed by an address (lower-cased), or null. */
export async function getByAddress(address: string): Promise<UsernameRecord | null> {
  const db = await load();
  const name = reverse.get(address.toLowerCase());
  return name ? db[name] ?? null : null;
}

export type PutResult =
  | { ok: true; record: UsernameRecord }
  | { ok: false; reason: 'name-taken' | 'address-has-name' };

/** First-come claim. Fails if the NAME is taken (by anyone) or the ADDRESS
 *  already owns a different name (one name per address). Re-claiming your own
 *  same name is idempotent (lets you update avatar). */
export async function putRecord(rec: UsernameRecord): Promise<PutResult> {
  return (writeChain = writeChain.then(async () => {})).then(async () => {
    const db = await load();
    const addr = rec.address.toLowerCase();
    const existing = db[rec.name];
    if (existing && existing.address.toLowerCase() !== addr) {
      return { ok: false, reason: 'name-taken' } as PutResult;
    }
    const ownedName = reverse.get(addr);
    if (ownedName && ownedName !== rec.name) {
      return { ok: false, reason: 'address-has-name' } as PutResult;
    }
    db[rec.name] = rec;
    rebuildReverse(db);
    await persist(db);
    return { ok: true, record: rec } as PutResult;
  });
}
