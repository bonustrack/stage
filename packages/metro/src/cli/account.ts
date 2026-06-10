/** `metro account` — safe account primitives over the per-station accounts
 *  files in ~/.metro: list, address, import (MetaMask-style raw key). */
/** Read paths prefer the live daemon (it boots xmtp clients, so it knows each
 *  eth address); they fall back to on-disk files when the daemon is down. */
/** Import writes a NEW entry only when invoked, atomically at 0600, and never
 *  restarts the daemon — `metro trains restart <station>` loads it. */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ipcCall } from '../ipc.js';
import { writeSecure, chmodIfExists } from '../secure-fs.js';
import { emit, exitErr, flagOne, isJson, type Flags } from './util.js';

type Station = 'xmtp' | 'discord' | 'telegram';
const STATIONS: Station[] = ['xmtp', 'discord', 'telegram'];

interface RawAccount {
  id?: string;
  privateKey?: string;
  derive?: number;
  token?: string;
  owner?: string;
}

interface AccountRow {
  id: string;
  station: Station;
  address: string | null;
  keySource: string;
  owner: string | null;
}

const ENV_FILE: Record<Station, string> = {
  xmtp: 'XMTP_ACCOUNTS_FILE',
  discord: 'DISCORD_ACCOUNTS_FILE',
  telegram: 'TELEGRAM_ACCOUNTS_FILE',
};

/** secp256k1 group order n — a valid EOA private key is in [1, n-1]. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function accountsPath(station: Station): string {
  return process.env[ENV_FILE[station]] || join(homedir(), '.metro', `${station}-accounts.json`);
}

function mnemonicPath(): string {
  return process.env.XMTP_MNEMONIC_FILE || join(homedir(), '.metro', 'xmtp-mnemonic');
}

/** Read + parse a station accounts file. Returns [] when absent; throws on
 *  malformed JSON so a corrupt file surfaces rather than silently emptying. */
function readAccounts(station: Station): RawAccount[] {
  const path = accountsPath(station);
  if (!existsSync(path)) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { throw exitErr(`bad ${path}: ${(e as Error).message}`, 2); }
  if (!Array.isArray(parsed)) throw exitErr(`${path} must be a JSON array`, 2);
  return parsed as RawAccount[];
}

function keySourceOf(a: RawAccount): string {
  if (typeof a.privateKey === 'string' && a.privateKey) return 'privateKey';
  if (typeof a.derive === 'number') return `derive:${a.derive}`;
  if (typeof a.token === 'string' && a.token) return 'token';
  return 'unknown';
}

/** Rows from on-disk files (no eth address — derivation needs the running client). */
function rowsFromDisk(only?: Station): AccountRow[] {
  const rows: AccountRow[] = [];
  for (const station of only ? [only] : STATIONS) {
    for (const a of readAccounts(station)) {
      if (!a || typeof a.id !== 'string') continue;
      rows.push({
        id: a.id, station, address: null, keySource: keySourceOf(a), owner: a.owner ?? null,
      });
    }
  }
  return rows;
}

interface DaemonAcct { id: string; address?: string; keySource?: string; owner?: string | null }

/** Ask the live daemon for a station's accounts (xmtp reports eth addresses).
 *  Returns null when the daemon is down or the call fails — caller falls back. */
async function rowsFromDaemon(station: Station): Promise<AccountRow[] | null> {
  try {
    const resp = await ipcCall({ op: 'forward-call', train: station, action: 'accounts', args: {} });
    if (!resp.ok || !('response' in resp) || resp.response.error) return null;
    const result = resp.response.result as { accounts?: DaemonAcct[] } | undefined;
    if (!result?.accounts) return null;
    return result.accounts.map(a => ({
      id: a.id, station,
      address: a.address ?? null,
      keySource: a.keySource ?? '-',
      owner: a.owner ?? null,
    }));
  } catch { return null; }
}

async function collectRows(only?: Station): Promise<AccountRow[]> {
  const out: AccountRow[] = [];
  for (const station of only ? [only] : STATIONS) {
    const live = await rowsFromDaemon(station);
    out.push(...(live ?? rowsFromDisk(station)));
  }
  return out;
}

/** Validate a raw private key: 32-byte hex within the secp256k1 range.
 *  Returns the normalized lowercase 0x form. Throws ExitErr on any problem. */
function normalizePrivKey(raw: string): string {
  const hex = raw.trim().toLowerCase();
  const withPrefix = hex.startsWith('0x') ? hex : `0x${hex}`;
  if (!/^0x[0-9a-f]{64}$/.test(withPrefix)) {
    throw exitErr('invalid private key: expected 32-byte hex (0x + 64 hex chars)', 1);
  }
  const n = BigInt(withPrefix);
  if (n === 0n || n >= SECP256K1_N) {
    throw exitErr('invalid private key: out of the secp256k1 range', 1);
  }
  return withPrefix;
}

function asStation(s: string | undefined): Station {
  if (s === 'xmtp' || s === 'discord' || s === 'telegram') return s;
  throw exitErr(`unknown station '${s}' (expected one of: ${STATIONS.join(', ')})`, 1);
}

async function cmdList(positional: string[], f: Flags): Promise<void> {
  const only = positional[0] ? asStation(positional[0]) : undefined;
  const rows = await collectRows(only);
  if (isJson(f)) return void emit(f, '', { accounts: rows });
  if (!rows.length) { process.stdout.write('(no accounts configured)\n'); return; }
  const head = ['ID', 'STATION', 'ADDRESS', 'KEY SOURCE', 'OWNER'];
  const body = rows.map(r => [r.id, r.station, r.address ?? '-', r.keySource, r.owner ?? '-']);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map(r => r[i].length)));
  const fmt = (cols: string[]): string => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  process.stdout.write(fmt(head) + '\n');
  for (const r of body) process.stdout.write(fmt(r) + '\n');
}

async function cmdAddress(positional: string[], f: Flags): Promise<void> {
  const id = positional[0];
  const withAddr = (await collectRows()).filter(r => r.address);
  const matches = id ? withAddr.filter(r => r.id === id) : withAddr;
  if (id && matches.length === 0) {
    throw exitErr(`no fundable (eth) address for account '${id}' (is the daemon running?)`, 1);
  }
  if (!id && matches.length !== 1) {
    throw exitErr(`specify an account id: ${withAddr.map(r => r.id).join(', ') || '(none)'}`, 1);
  }
  if (isJson(f)) {
    return void emit(f, '', { accounts: matches.map(r => ({ id: r.id, address: r.address })) });
  }
  for (const r of matches) process.stdout.write(`${r.address}\n`);
}

function cmdImport(positional: string[], f: Flags): void {
  const [stationArg, key] = positional;
  if (!stationArg || !key) {
    throw exitErr('usage: metro account import <station> <privkey> --id <name>', 1);
  }
  const station = asStation(stationArg);
  if (station !== 'xmtp') {
    throw exitErr('private-key import is only supported for the xmtp station', 1);
  }
  const id = flagOne(f, 'id');
  if (!id) throw exitErr('missing --id <name> for the imported account', 1);
  const privateKey = normalizePrivKey(key);

  const path = accountsPath(station);
  const existing = readAccounts(station);
  if (existing.some(a => a.id === id)) {
    throw exitErr(`account id '${id}' already exists in ${path}`, 1);
  }
  if (existing.some(a => (a.privateKey ?? '').toLowerCase() === privateKey)) {
    throw exitErr(`that private key is already imported in ${path}`, 1);
  }
  const next = [...existing, { id, privateKey }];
  writeSecure(path, JSON.stringify(next, null, 2) + '\n');

  const restartHint = `run \`metro trains restart ${station}\` to load it, `
    + `then \`metro account address ${id}\` for its fundable eth address`;
  emit(f,
    `imported ${station} account '${id}' into ${path} (mode 0600)\n${restartHint}`,
    { ok: true, id, station, file: path, restartRequired: true, restartHint });
}

export async function cmdAccount(positional: string[], flags: Flags): Promise<void> {
  // Best-effort perms hardening on any creds files we touch (MODE only).
  for (const s of STATIONS) chmodIfExists(accountsPath(s));
  chmodIfExists(mnemonicPath());

  const sub = positional[0];
  const rest = positional.slice(1);
  switch (sub) {
    case 'list': return cmdList(rest, flags);
    case 'address': return cmdAddress(rest, flags);
    case 'import': return cmdImport(rest, flags);
    default:
      throw exitErr('usage: metro account <list|address|import> ...', 1);
  }
}
