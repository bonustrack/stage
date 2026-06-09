/** XMTP multi-account config, key resolution, client boot, and line routing. */

import { Client, IdentifierKind, type Conversation, type Signer } from '@xmtp/node-sdk';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CODECS } from './codecs.js';
import { makeAccountStore } from '../account-store.js';
import { chmodIfExists } from '../../secure-fs.js';
import { Line } from '../../lines.js';

const ACCOUNTS_FILE = process.env.XMTP_ACCOUNTS_FILE ?? join(homedir(), '.metro', 'xmtp-accounts.json');

export type XmtpEnv = 'production' | 'dev' | 'local';
export interface AccountConfig {
  id: string;
  /** Signing key, EXACTLY ONE of `privateKey` (raw 0x EOA) or `derive`
   *  (HD index into the stored mnemonic, m/44'/60'/0'/0/<index>). */
  privateKey?: string;
  derive?: number;
  env?: XmtpEnv;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
  /** node-sdk local MLS db; defaults to per-account path. */
  dbPath?: string;
}

const MNEMONIC_FILE = process.env.XMTP_MNEMONIC_FILE ?? join(homedir(), '.metro', 'xmtp-mnemonic');

export const { die, loadAccounts } = makeAccountStore<AccountConfig>({
  prefix: 'xmtp',
  file: ACCOUNTS_FILE,
  allowlistEnv: ['XMTP_ONLY_ACCOUNTS', 'XMTP_ACCOUNTS'],
  validate(raw, die) {
    const seen = new Set<string>();
    for (const a of raw) {
      if (!a.id) die('account missing id');
      const hasKey = typeof a.privateKey === 'string' && a.privateKey.length > 0;
      const hasDerive = typeof a.derive === 'number';
      if (hasKey === hasDerive) die(`account '${a.id}' must set EXACTLY ONE of privateKey or derive`);
      if (hasDerive && (a.derive! < 0 || !Number.isInteger(a.derive))) {
        die(`account '${a.id}' derive must be a non-negative integer`);
      }
      if (seen.has(a.id)) die(`duplicate account id '${a.id}'`);
      seen.add(a.id);
    }
  },
  /** Back-compat: single account from env. */
  fallback(die) {
    const pk = process.env.XMTP_PRIVATE_KEY;
    if (!pk) die(`no ${ACCOUNTS_FILE} and XMTP_PRIVATE_KEY unset`);
    return [{ id: 'default', privateKey: pk, env: (process.env.XMTP_ENV as XmtpEnv) ?? 'production' }];
  },
});

let cachedMnemonic: string | null = null;
function loadMnemonic(): string {
  if (cachedMnemonic) return cachedMnemonic;
  const inline = process.env.XMTP_MNEMONIC?.trim();
  if (inline) { cachedMnemonic = inline; return inline; }
  if (!existsSync(MNEMONIC_FILE)) {
    die(`an account uses "derive" but no mnemonic found (set XMTP_MNEMONIC or place ${MNEMONIC_FILE})`);
  }
  chmodIfExists(MNEMONIC_FILE); // harden perms on load (MODE only, content untouched)
  const m = readFileSync(MNEMONIC_FILE, 'utf8').trim();
  if (!m) die(`${MNEMONIC_FILE} is empty`);
  cachedMnemonic = m;
  return m;
}

/** Resolve an account's raw 0x private key from either `privateKey` or `derive`. */
function resolvePrivateKey(cfg: AccountConfig): string {
  if (typeof cfg.derive === 'number') {
    const acct = mnemonicToAccount(loadMnemonic(), { addressIndex: cfg.derive });
    return toHex(acct.getHdKey().privateKey!); // HD path m/44'/60'/0'/0/<derive>
  }
  if (cfg.privateKey) return cfg.privateKey;
  throw new Error(`account '${cfg.id}' has neither privateKey nor derive`);
}

// Set XMTP_LEGACY_DEFAULT_LINES=1 to keep the default account emitting legacy
// metro://xmtp/<conv> lines (zero migration for existing claims/deep-links).
const LEGACY_DEFAULT_LINES = process.env.XMTP_LEGACY_DEFAULT_LINES === '1';

const expandHome = (p: string): string => p.startsWith('~') ? join(homedir(), p.slice(1)) : p;

export interface Account {
  cfg: AccountConfig;
  client: Client;
  inboxId: string;
  address: string;
}
export const accounts = new Map<string, Account>();

function signerFor(privateKey: string): { signer: Signer; address: string } {
  const acct = privateKeyToAccount(privateKey as `0x${string}`);
  const signer: Signer = {
    type: 'EOA',
    getIdentifier: async () => ({ identifier: acct.address, identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (msg: string) => {
      const sig = await acct.signMessage({ message: msg });
      const hex = sig.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    },
  };
  return { signer, address: acct.address };
}

export async function bootAccount(cfg: AccountConfig): Promise<void> {
  const env = (cfg.env ?? 'production') as XmtpEnv;
  const { signer, address } = signerFor(resolvePrivateKey(cfg));
  const dbPath = expandHome(cfg.dbPath ?? join(homedir(), '.metro', `xmtp-${env}-${cfg.id}.db3`));
  const client = await Client.create(signer, { env, codecs: CODECS(), dbPath });
  accounts.set(cfg.id, { cfg, client, inboxId: client.inboxId, address });
  process.stderr.write(
    `xmtp[${cfg.id}] ready — inbox ${client.inboxId} (${address}, env=${env}, owner=${cfg.owner ?? '(broadcast)'})\n`);
}

/** Per-account line. The default account may emit legacy lines for migration. */
export function lineOf(accountId: string, convId: string): string {
  if (accountId === 'default' && LEGACY_DEFAULT_LINES) return `metro://xmtp/${convId}`;
  return `metro://xmtp/${accountId}/${convId}`;
}

/** Parse a line back to {accountId, convId}. Accepts new + legacy forms.
 *  Delegates to the canonical `Line.parseXmtp` (single source of truth for the
 *  metro:// scheme); convId is the account-scoped `resource` segment. */
export function parseLine(line: string): { accountId: string; convId: string } | null {
  const p = Line.parseXmtp(line);
  return p ? { accountId: p.accountId, convId: p.resource } : null;
}

export function accountForCall(args: { account?: string; line?: string }): Account {
  let id = args.account;
  if (!id && args.line) id = parseLine(args.line)?.accountId;
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  const acct = accounts.get(id);
  if (!acct) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return acct;
}

export async function convOf(line: string): Promise<{ acct: Account; conv: Conversation | undefined }> {
  const parsed = parseLine(line);
  if (!parsed) throw new Error(`bad xmtp line: ${line}`);
  const acct = accounts.get(parsed.accountId);
  if (!acct) throw new Error(`unknown account '${parsed.accountId}' in line ${line}`);
  return { acct, conv: await acct.client.conversations.getConversationById(parsed.convId) };
}
