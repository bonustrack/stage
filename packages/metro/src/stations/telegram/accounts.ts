/** Telegram multi-bot account config + per-account Bot API clients. */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { makeAccountStore } from '../account-store.js';

const ACCOUNTS_FILE = process.env.TELEGRAM_ACCOUNTS_FILE
  ?? join(homedir(), '.metro', 'telegram-accounts.json');

export interface AccountConfig {
  id: string;
  /** Telegram bot token for this identity. */
  token: string;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
}

/** Legacy metro://telegram/<chatId> lines for the default account (migration). */
export const legacy = { defaultLines: process.env.TELEGRAM_LEGACY_DEFAULT_LINES === '1' };

export const { loadAccounts } = makeAccountStore<AccountConfig>({
  prefix: 'telegram',
  file: ACCOUNTS_FILE,
  allowlistEnv: ['TELEGRAM_ONLY_ACCOUNTS', 'TELEGRAM_ACCOUNTS'],
  validate(raw, die) {
    const seenId = new Set<string>();
    const seenTok = new Set<string>();
    for (const a of raw) {
      if (!a.id) die('account missing id');
      if (!a.token || typeof a.token !== 'string') die(`account '${a.id}' missing token`);
      if (seenId.has(a.id)) die(`duplicate account id '${a.id}'`);
      // Two loops polling the SAME token => 409 Conflict. Reject early.
      if (seenTok.has(a.token)) die(`account '${a.id}' reuses a token used by another account (409 on getUpdates)`);
      seenId.add(a.id); seenTok.add(a.token);
    }
  },
  /** Back-compat: single account from env, legacy lines so existing claims keep working. */
  fallback(die) {
    const tok = process.env.TELEGRAM_BOT_TOKEN;
    if (!tok) return die(`no ${ACCOUNTS_FILE} and TELEGRAM_BOT_TOKEN unset`);
    legacy.defaultLines = true;
    return [{ id: 'default', token: tok }];
  },
});

export interface Account {
  cfg: AccountConfig;
  api: string;
  fileApi: string;
  offset: number;
}
export const accounts = new Map<string, Account>();

export async function tg<T>(accountId: string, method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const acct = accounts.get(accountId);
  if (!acct) throw new Error(`unknown account '${accountId}'`);
  const res = await fetch(`${acct.api}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown'}`);
  return json.result as T;
}

export async function tgForm<T>(accountId: string, method: string, form: FormData, timeoutMs = 60_000): Promise<T> {
  const acct = accounts.get(accountId);
  if (!acct) throw new Error(`unknown account '${accountId}'`);
  const res = await fetch(`${acct.api}/${method}`,
    { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown'}`);
  return json.result as T;
}

export function accountFor(args: { account?: string; line?: string }): string {
  let id = args.account;
  if (!id && args.line) { try { id = targetOf(args.line).accountId; } catch { /* ignore */ } }
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  if (!accounts.has(id)) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return id;
}

/** Account-scoped line. The default account may emit legacy lines for migration. */
export function lineOf(accountId: string, chatId: number | string, topicId?: number): string {
  const tail = topicId !== undefined ? `${chatId}/${topicId}` : `${chatId}`;
  if (accountId === 'default' && legacy.defaultLines) return `metro://telegram/${tail}`;
  return `metro://telegram/${accountId}/${tail}`;
}

/** Parse a line back to {accountId, chatId, topicId}. Accepts new + legacy forms.
 *  chatId is signed; accountId is non-numeric, disambiguating legacy from new. */
export function targetOf(
  line: string, accountOverride?: string,
): { accountId: string; chatId: number; topicId?: number } {
  const mNew = line.match(/^metro:\/\/telegram\/([^/]+)\/(-?\d+)(?:\/(\d+))?$/);
  if (mNew && !/^-?\d+$/.test(mNew[1])) {
    return {
      accountId: accountOverride ?? mNew[1], chatId: Number(mNew[2]),
      topicId: mNew[3] ? Number(mNew[3]) : undefined,
    };
  }
  const mLegacy = line.match(/^metro:\/\/telegram\/(-?\d+)(?:\/(\d+))?$/);
  if (mLegacy) {
    return {
      accountId: accountOverride ?? 'default', chatId: Number(mLegacy[1]),
      topicId: mLegacy[2] ? Number(mLegacy[2]) : undefined,
    };
  }
  throw new Error(`bad telegram line: ${line}`);
}
