/** FCM push pipeline (token store, OAuth, fan-out) + inbound control-DM handling. */

import { type DecodedMessage } from '@xmtp/node-sdk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const FCM_SVC_PATH = `${process.env.HOME}/.config/metro/firebase-service-account.json`;
const FCM_TOKENS_PATH = `${process.env.HOME}/.cache/metro/xmtp-push-tokens.json`;
interface FcmServiceAccount { client_email: string; private_key: string; project_id: string; token_uri: string }

// Per-device token. `account` scopes to a daemon accountId; `inboxIds` = every inbox
// that registered this device (legacy rows: {token,registeredAt}).
interface StoredPushToken {
  token: string; registeredAt: string; account?: string;
  inboxId?: string; inboxIds?: string[]; platform?: string; lastSeenAt?: string;
}

function loadFcmSvc(): FcmServiceAccount | null {
  if (!existsSync(FCM_SVC_PATH)) return null;
  try { return JSON.parse(readFileSync(FCM_SVC_PATH, 'utf8')) as FcmServiceAccount; }
  catch (err) { process.stderr.write(`fcm: bad service account: ${(err as Error).message}\n`); return null; }
}
export function loadPushTokens(): StoredPushToken[] {
  if (!existsSync(FCM_TOKENS_PATH)) return [];
  try { return JSON.parse(readFileSync(FCM_TOKENS_PATH, 'utf8')) as StoredPushToken[]; } catch { return []; }
}
export function savePushTokens(tokens: StoredPushToken[]): void {
  mkdirSync(dirname(FCM_TOKENS_PATH), { recursive: true });
  writeFileSync(FCM_TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

/** Upsert a device token (deduped by token); returns the new total count.
 *  Carries forward every inbox this device registered (one FCM token) → never self-notify. */
export function storePushToken(
  entry: { token: string; account?: string; inboxId?: string; platform?: string },
): number {
  const now = new Date().toISOString();
  const all = loadPushTokens();
  const existing = all.find(t => t.token === entry.token);
  const remaining = all.filter(t => t.token !== entry.token);
  const inboxIds = new Set<string>(existing?.inboxIds ?? []);
  if (existing?.inboxId) inboxIds.add(existing.inboxId);
  if (entry.inboxId) inboxIds.add(entry.inboxId);
  const row: StoredPushToken = { token: entry.token, registeredAt: existing?.registeredAt ?? now, lastSeenAt: now };
  if (entry.account) row.account = entry.account;
  if (entry.inboxId) row.inboxId = entry.inboxId;
  if (inboxIds.size) row.inboxIds = [...inboxIds];
  if (entry.platform) row.platform = entry.platform;
  remaining.push(row);
  savePushTokens(remaining);
  return remaining.length;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
async function fcmAccessToken(): Promise<string | null> {
  const svc = loadFcmSvc(); if (!svc) return null;
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.token;
  const { createSign } = await import('node:crypto');
  const enc = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: svc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: svc.token_uri, iat: now, exp: now + 3600,
  };
  const sigInput = `${enc(header)}.${enc(payload)}`;
  const signer = createSign('RSA-SHA256'); signer.update(sigInput); signer.end();
  const sig = signer.sign(svc.private_key).toString('base64url');
  const jwt = `${sigInput}.${sig}`;
  const grant = encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer');
  const res = await fetch(svc.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${grant}&assertion=${jwt}`,
  });
  if (!res.ok) { process.stderr.write(`fcm token exchange ${res.status}: ${await res.text()}\n`); return null; }
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedAccessToken.token;
}

/** Result of one delivery attempt: ok=delivered; dead=stale token (pruned, don't
 *  retry); transient=worth a retry (5xx, network, auth blip). */
type PushOutcome = 'ok' | 'dead' | 'transient';

async function fcmPushOnce(
  deviceToken: string, data: Record<string, string> = {},
): Promise<PushOutcome> {
  const svc = loadFcmSvc(); if (!svc) return 'transient';
  const at = await fcmAccessToken(); if (!at) return 'transient';
  const url = `https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`;
  // CONTENTLESS DATA-ONLY message — no `notification` block, no plaintext; device builds the card.
  const payloadData: Record<string, string> = { channelId: 'xmtp', ...data };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
      body: JSON.stringify({ message: { token: deviceToken, android: { priority: 'HIGH' }, data: payloadData } }),
    });
  } catch (err) {
    // Network failure (DNS/TLS/timeout) — transient, retry once.
    process.stderr.write(`fcm push network error for ${deviceToken.slice(0, 12)}…: ${(err as Error).message}\n`);
    return 'transient';
  }
  if (res.ok) return 'ok';
  const txt = await res.text().catch(() => '');
  // Dead token (uninstalled/rotated) → prune. (INVALID_ARGUMENT = bad payload, NOT stale.)
  const dead = res.status === 404 || txt.includes('UNREGISTERED')
    || txt.includes('NOT_FOUND') || txt.includes('registration-token-not-registered')
    || txt.includes('NotRegistered');
  if (dead) {
    removePushToken(deviceToken);
    process.stderr.write(`fcm: pruned stale token ${deviceToken.slice(0, 12)}…\n`); return 'dead';
  }
  process.stderr.write(`fcm push ${res.status} for ${deviceToken.slice(0, 12)}…: ${txt}\n`);
  // 5xx / 429 are server-side and retryable; 4xx (bad payload/auth) are not.
  return (res.status >= 500 || res.status === 429) ? 'transient' : 'ok';
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** Send one contentless push, with ONE retry after 2s on a transient failure.
 *  Every failure is logged to stderr (the live daemon's only push observability). */
async function fcmPushTo(
  deviceToken: string, data: Record<string, string> = {},
): Promise<void> {
  const first = await fcmPushOnce(deviceToken, data);
  if (first !== 'transient') return;
  await sleep(2000);
  const retry = await fcmPushOnce(deviceToken, data);
  if (retry === 'transient') {
    process.stderr.write(`fcm push gave up after retry for ${deviceToken.slice(0, 12)}…\n`);
  } else if (retry === 'ok') {
    process.stderr.write(`fcm push recovered on retry for ${deviceToken.slice(0, 12)}…\n`);
  }
}

/** ONE token per account: freshest by lastSeenAt → registeredAt (two app variants
 *  on one phone = double push). Unscoped rows pass through as-is. */
function freshestPerAccount(tokens: StoredPushToken[]): StoredPushToken[] {
  const freshness = (t: StoredPushToken): number =>
    new Date(t.lastSeenAt ?? t.registeredAt ?? 0).getTime();
  const byAccount = new Map<string, StoredPushToken>();
  const unscoped: StoredPushToken[] = [];
  for (const t of tokens) {
    if (!t.account) { unscoped.push(t); continue; }
    const cur = byAccount.get(t.account);
    if (!cur || freshness(t) >= freshness(cur)) byAccount.set(t.account, t);
  }
  return [...byAccount.values(), ...unscoped];
}

/** Push CONTENTLESS routing data to every token, or only those scoped to (or
 *  unscoped for) `accountId`. No plaintext ever crosses this boundary. */
export async function fcmPushToAll(
  accountId: string, data: Record<string, string> = {}, excludeInboxId?: string,
): Promise<void> {
  // Scope to the account; skip the sender's OWN device(s) by inboxId/inboxIds.
  const tokens = loadPushTokens().filter(t => {
    if (t.account && t.account !== accountId) return false;
    if (excludeInboxId && (t.inboxId === excludeInboxId || t.inboxIds?.includes(excludeInboxId))) return false;
    return true;
  });
  const deduped = freshestPerAccount(tokens); // exactly ONE notification per device
  if (deduped.length === 0) {
    // No registered device → nothing wakes the app until a foreground resync.
    // Surface it: a silent empty store is exactly how a stale-prune outage hides.
    process.stderr.write(`fcm: no push tokens for account ${accountId} — push skipped\n`);
    return;
  }
  await Promise.all(deduped.map(
    t => fcmPushTo(t.token, { ...data, account: accountId }).catch(() => undefined)));
}

// control DM (inbound) — wire fmt: apps/app/lib/pushRegister.control.ts. Bodies:
// METRO_CTRL:register-push:{v,token,platform,address,inboxId} | disable-push:{v,token,address,inboxId}
const METRO_CTRL_PREFIX = 'METRO_CTRL:';
const CTRL_REGISTER_PUSH = 'register-push';
const CTRL_DISABLE_PUSH = 'disable-push';

/** Drop a device token from the store (push OFF). Returns remaining count, or -1
 *  if absent. Deletes the row so fan-out (reads loadPushTokens) instantly stops. */
export function removePushToken(token: string): number {
  const all = loadPushTokens();
  const remaining = all.filter(t => t.token !== token);
  if (remaining.length === all.length) return -1;
  savePushTokens(remaining); return remaining.length;
}

/** Mirror of the app's `isMetroControlBody` (prefix-only test) so every control
 *  verb — current or future — is filtered out of chat/push. */
function isMetroControlBody(text: unknown): text is string {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

interface RegisterPushPayload { v?: number; token: string; platform?: string; address?: string; inboxId?: string }
interface DisablePushPayload { v?: number; token: string; address?: string; inboxId?: string }

/** Handle an inbound control DM. Returns true iff it was a control DM (so it must
 *  NOT be surfaced as chat or pushed). Best-effort: never throws. */
export function handleControlDm(accountId: string, msg: DecodedMessage): boolean {
  const body = msg.content;
  if (!isMetroControlBody(body)) return false;
  const rest = body.slice(METRO_CTRL_PREFIX.length);
  const sep = rest.indexOf(':');
  const verb = sep === -1 ? rest : rest.slice(0, sep);
  const arg = sep === -1 ? '' : rest.slice(sep + 1);
  try {
    if (verb === CTRL_REGISTER_PUSH) {
      const obj = JSON.parse(arg) as Partial<RegisterPushPayload>;
      if (!obj || typeof obj.token !== 'string' || obj.token.length < 20) {
        process.stderr.write(`xmtp[${accountId}]: register-push (ctrl-dm) ignored — bad/short token\n`);
        return true;
      }
      const total = storePushToken({
        token: obj.token, account: accountId, inboxId: msg.senderInboxId,
        platform: typeof obj.platform === 'string' ? obj.platform : undefined,
      });
      process.stderr.write(`xmtp[${accountId}]: register-push (ctrl-dm) stored token ${obj.token.slice(0, 12)}… `
        + `from inbox ${msg.senderInboxId.slice(0, 10)}… (v=${obj.v ?? '?'}, ${total} total)\n`);
    } else if (verb === CTRL_DISABLE_PUSH) {
      const obj = JSON.parse(arg) as Partial<DisablePushPayload>;
      if (!obj || typeof obj.token !== 'string' || obj.token.length < 20) {
        process.stderr.write(`xmtp[${accountId}]: disable-push (ctrl-dm) ignored — bad/short token\n`);
        return true;
      }
      const remaining = removePushToken(obj.token);
      process.stderr.write(`xmtp[${accountId}]: disable-push (ctrl-dm) token ${obj.token.slice(0, 12)}… `
        + (remaining === -1 ? 'not found (already gone)\n' : `removed (v=${obj.v ?? '?'}, ${remaining} remain)\n`));
    } else {
      process.stderr.write(`xmtp[${accountId}]: unknown control verb '${verb}' — swallowed\n`);
    }
  } catch (err) {
    process.stderr.write(`xmtp[${accountId}]: control DM '${verb}' FAILED: ${(err as Error).message}\n`);
  }
  return true;
}

