/** Discord multi-bot account config + per-account REST client + line routing. */

import { Client } from 'discord.js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const API = 'https://discord.com/api/v10';

const ACCOUNTS_FILE = process.env.DISCORD_ACCOUNTS_FILE
  ?? join(homedir(), '.metro', 'discord-accounts.json');

export interface AccountConfig {
  id: string;
  /** Discord bot token for this identity. */
  token: string;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
}

// Set DISCORD_LEGACY_DEFAULT_LINES=1 to keep the default account emitting legacy
// metro://discord/<channelId> lines (zero migration). Auto-on in single-token mode.
export const legacy = { defaultLines: process.env.DISCORD_LEGACY_DEFAULT_LINES === '1' };

const ACCOUNT_ALLOWLIST = new Set(
  (process.env.DISCORD_ONLY_ACCOUNTS ?? process.env.DISCORD_ACCOUNTS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
);

const die = (msg: string): never => { process.stderr.write(`discord: ${msg}\n`); process.exit(2); };

export function loadAccounts(): AccountConfig[] {
  if (existsSync(ACCOUNTS_FILE)) {
    let raw: AccountConfig[];
    try { raw = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as AccountConfig[]; }
    catch (e) { return die(`bad ${ACCOUNTS_FILE}: ${(e as Error).message}`); }
    if (!Array.isArray(raw) || raw.length === 0) die(`${ACCOUNTS_FILE} must be a non-empty array`);
    const seen = new Set<string>();
    for (const a of raw) {
      if (!a.id) die('account missing id');
      if (!a.token || typeof a.token !== 'string') die(`account '${a.id}' missing token`);
      if (seen.has(a.id)) die(`duplicate account id '${a.id}'`);
      seen.add(a.id);
    }
    const selected = ACCOUNT_ALLOWLIST.size ? raw.filter(a => ACCOUNT_ALLOWLIST.has(a.id)) : raw;
    if (selected.length === 0) die(`no accounts match DISCORD_ONLY_ACCOUNTS (${[...ACCOUNT_ALLOWLIST].join(', ')})`);
    return selected;
  }
  /** Back-compat: single account from env, legacy lines so existing claims keep working. */
  const tok = process.env.DISCORD_BOT_TOKEN;
  if (!tok) return die(`no ${ACCOUNTS_FILE} and DISCORD_BOT_TOKEN unset`);
  legacy.defaultLines = true;
  return [{ id: 'default', token: tok }];
}

export interface Account {
  cfg: AccountConfig;
  client: Client;
}
export const accounts = new Map<string, Account>();

export async function rest<T = unknown>(
  accountId: string, method: string, path: string, body?: unknown, isForm = false,
): Promise<T> {
  const acct = accounts.get(accountId);
  if (!acct) throw new Error(`unknown account '${accountId}'`);
  const headers: Record<string, string> = {
    Authorization: `Bot ${acct.cfg.token}`,
    'User-Agent': 'metro-discord-train (https://github.com/bonustrack/metro)',
  };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers,
    body: body === undefined ? undefined : isForm ? (body as BodyInit) : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ctype = res.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) return res.json() as Promise<T>;
  return res.arrayBuffer().then(b => Buffer.from(b) as unknown as T);
}

/** Per-account line. The default account may emit legacy lines for migration. */
export function lineOf(accountId: string, channelId: string): string {
  if (accountId === 'default' && legacy.defaultLines) return `metro://discord/${channelId}`;
  return `metro://discord/${accountId}/${channelId}`;
}

/** Parse a line back to {accountId, channelId}. Accepts new + legacy forms.
 *  channelId is an all-digit snowflake; a non-numeric accountId disambiguates. */
export function parseLine(line: string): { accountId: string; channelId: string } | null {
  const mNew = line.match(/^metro:\/\/discord\/([^/]+)\/(\d+)$/);
  if (mNew) return { accountId: mNew[1], channelId: mNew[2] };
  const mLegacy = line.match(/^metro:\/\/discord\/(\d+)$/);
  if (mLegacy) return { accountId: 'default', channelId: mLegacy[1] };
  return null;
}

/** Resolve which account to use: explicit arg → from line → sole/default. */
export function accountFor(args: { account?: string; line?: string }): string {
  let id = args.account;
  if (!id && args.line) id = parseLine(args.line)?.accountId;
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  if (!accounts.has(id)) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return id;
}

/** Parse {accountId, channelId} from a line, asserting the account is booted. */
export function routeOf(line: string, account?: string): { accountId: string; channelId: string } {
  const parsed = parseLine(line);
  if (!parsed) throw new Error(`bad discord line: ${line}`);
  const accountId = account ?? parsed.accountId;
  if (!accounts.has(accountId)) throw new Error(`unknown account '${accountId}' in line ${line}`);
  return { accountId, channelId: parsed.channelId };
}

export const encodeEmoji = (e: string): string => encodeURIComponent(e);
