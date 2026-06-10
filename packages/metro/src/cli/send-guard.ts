/** Per-session SEND-GUARD for `metro call xmtp <outbound>`. One shared daemon */
/** serves multiple CLIs (Claude = `tony` account, Codex = `codex` account). A */
/** `metro call xmtp send {line:"metro://xmtp/<account>/…"}` sends from whatever */
/** account the LINE names — so a Codex-side caller could accidentally send on */
/** the `tony` account (wrong identity). This guard rejects an outbound call */
/** when the caller's session does NOT own the target account. */

/** The xmtp train (~/.metro/trains/xmtp.ts) is owned/edited by others, so the */
/** guard lives here in the CLI rather than in the train. */

/** SAFETY: this guards IDENTITY, so a false-reject that blocks a legitimate */
/** send is worse than the rare bypass. We enforce ONLY when BOTH the caller */
/** station and the target account's owner station are known AND they conflict. */
/** If either is unknown (a human running metro directly, an account with no */
/** owner) we ALLOW. `METRO_ALLOW_CROSS_ACCOUNT=1` is an explicit escape hatch. */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Line } from '../lines.js';
import { exitErr } from './util.js';

/** Outbound xmtp actions that target a conversation/account and therefore send */
/** under some account's identity. Read-only actions (accounts, query, */
/** listConvs, groupInfo, *-push) are intentionally NOT guarded. */
const GUARDED_XMTP_ACTIONS = new Set([
  'send', 'reply', 'react', 'sendAttachment', 'newDm', 'newGroup',
]);

/** Stations we can attribute a CLI session to. Mirrors history.userSelf()/selfLine(). */
type Station = 'claude' | 'codex';

/** Resolve the CALLER's station from env, the same way history.ts does it. Null */
/** when neither is set (e.g. a human running metro directly) — caller is then */
/** treated as trusted/admin and the guard does not enforce. */
function callerStation(): Station | null {
  if (process.env.CLAUDECODE) return 'claude';
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) return 'codex';
  return null;
}

/** Parse the target account id from an xmtp action's args. Mirrors the train's */
/** accountForCall(): explicit `account` wins, else the account segment of the */
/** line (`metro://xmtp/<account>/<conv>`; legacy `metro://xmtp/<conv>` → `default`). */
function targetAccount(args: unknown): string | null {
  if (!args || typeof args !== 'object') return null;
  const a = args as { account?: unknown; line?: unknown };
  if (typeof a.account === 'string' && a.account) return a.account;
  if (typeof a.line === 'string' && a.line) {
    /** Account-segment precedence lives in one place — the canonical parser:
     *  new form `<account>/<conv>`; legacy single-segment → the `default` account. */
    return Line.parseXmtp(a.line)?.accountId ?? null;
  }
  return null;
}

type AccountCfg = { id?: string; owner?: string };

/** Look up the owner station of an xmtp account from ~/.metro/xmtp-accounts.json. */
/** Null when the file is missing/unreadable, the account isn't listed, it has no */
/** owner, or the owner URI isn't a claude/codex station — all of which mean */
/** "can't attribute ownership", so the guard allows the send. */
function accountOwnerStation(accountId: string): Station | null {
  const path = process.env.XMTP_ACCOUNTS_FILE || join(homedir(), '.metro', 'xmtp-accounts.json');
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return null; }
  let accounts: AccountCfg[];
  try {
    const parsed = JSON.parse(raw);
    accounts = Array.isArray(parsed) ? parsed : [];
  } catch { return null; }
  const acct = accounts.find(a => a?.id === accountId);
  if (!acct?.owner) return null;
  const station = Line.station(acct.owner);
  return station === 'claude' || station === 'codex' ? station : null;
}

/** Throw an ExitErr (non-zero exit) when a `metro call` would send XMTP under an */
/** account owned by a DIFFERENT CLI session than the caller's. No-op for any */
/** other train/action and whenever ownership can't be unambiguously attributed. */
export function enforceSendGuard(train: string, action: string, args: unknown): void {
  if (train !== 'xmtp' || !GUARDED_XMTP_ACTIONS.has(action)) return;
  if (process.env.METRO_ALLOW_CROSS_ACCOUNT === '1') return; // explicit opt-out

  const caller = callerStation();
  if (!caller) return; // unknown caller (human/admin) → allow

  const account = targetAccount(args);
  if (!account) return; // can't determine target account → allow

  const owner = accountOwnerStation(account);
  if (!owner) return; // account has no known owner → allow

  /** Enforce only when BOTH are known AND they conflict. */
  if (owner !== caller) {
    throw exitErr(
      `metro: refusing to send on account '${account}' (owned by ${owner}) from a ${caller} session — ` +
      'you can only send from your own account (set METRO_ALLOW_CROSS_ACCOUNT=1 to override)',
      4,
    );
  }
}
