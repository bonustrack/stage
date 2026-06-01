/** FCM push pipeline (token store, OAuth, fan-out) + inbound control-DM handling. */

import { type DecodedMessage } from '@xmtp/node-sdk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const FCM_SVC_PATH = `${process.env.HOME}/.config/metro/firebase-service-account.json`;
const FCM_TOKENS_PATH = `${process.env.HOME}/.cache/metro/xmtp-push-tokens.json`;
interface FcmServiceAccount { client_email: string; private_key: string; project_id: string; token_uri: string }

// Per-device push token. `account` scopes it to a daemon accountId; `inboxIds`
// accumulates every inbox that registered this device so a multi-account phone is
// "self" for all of them. Legacy rows may have only {token, registeredAt}.
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
  try { return JSON.parse(readFileSync(FCM_TOKENS_PATH, 'utf8')) as StoredPushToken[]; }
  catch { return []; }
}
export function savePushTokens(tokens: StoredPushToken[]): void {
  mkdirSync(dirname(FCM_TOKENS_PATH), { recursive: true });
  writeFileSync(FCM_TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

/** Upsert a device token (deduped by token); returns the new total count. */
export function storePushToken(entry: {
  token: string; account?: string; inboxId?: string; platform?: string;
}): number {
  const now = new Date().toISOString();
  const all = loadPushTokens();
  const existing = all.find(t => t.token === entry.token);
  const remaining = all.filter(t => t.token !== entry.token);
  // Accumulate inbox ids across account switches on the same device: a phone keeps
  // ONE FCM token, so carry forward every inbox it registered → never self-notify.
  const inboxIds = new Set<string>(existing?.inboxIds ?? []);
  if (existing?.inboxId) inboxIds.add(existing.inboxId);
  if (entry.inboxId) inboxIds.add(entry.inboxId);
  const row: StoredPushToken = {
    token: entry.token, registeredAt: existing?.registeredAt ?? now, lastSeenAt: now,
  };
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
  const svc = loadFcmSvc();
  if (!svc) return null;
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

async function fcmPushTo(
  deviceToken: string, title: string, body: string, data: Record<string, string> = {},
): Promise<void> {
  const svc = loadFcmSvc(); if (!svc) return;
  const at = await fcmAccessToken(); if (!at) return;
  const url = `https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`;
  // DATA-ONLY high-priority message — NO `notification` block. The APK's native
  // MetroFcmService builds the Telegram-style notification from data.{title,body,
  // avatarUrl,channelId}; a notification block would bypass the native handler.
  const payloadData: Record<string, string> = { channelId: 'xmtp', ...data, title: String(title), body: String(body) };
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
    body: JSON.stringify({ message: { token: deviceToken, android: { priority: 'HIGH' }, data: payloadData } }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // Only UNREGISTERED / NOT_FOUND mean a dead token → prune. INVALID_ARGUMENT is a
    // malformed-payload signal (e.g. bad image URL), NOT a stale token.
    if (txt.includes('UNREGISTERED') || txt.includes('NOT_FOUND')) {
      savePushTokens(loadPushTokens().filter(t => t.token !== deviceToken));
      process.stderr.write(`fcm: pruned stale token ${deviceToken.slice(0, 12)}…\n`); return;
    }
    process.stderr.write(`fcm push ${res.status}: ${txt}\n`);
  }
}

/** Push to every token, or only those scoped to (or unscoped for) `accountId`. */
export async function fcmPushToAll(
  accountId: string, title: string, body: string,
  data: Record<string, string> = {}, excludeInboxId?: string,
): Promise<void> {
  // Scope to the account and skip the sender's OWN device(s) (you don't get pushed
  // for a message you just sent). Sender match is by stored inboxId/inboxIds.
  const tokens = loadPushTokens().filter(t => {
    if (t.account && t.account !== accountId) return false;
    if (excludeInboxId && (t.inboxId === excludeInboxId || t.inboxIds?.includes(excludeInboxId))) return false;
    return true;
  });
  if (tokens.length === 0) return;
  await Promise.all(tokens.map(
    t => fcmPushTo(t.token, title, body, { ...data, account: accountId }).catch(() => undefined)));
}

// ──────────── control DM (inbound, F2) — wire format from PR #135 ────────────
// SINGLE SOURCE OF TRUTH: apps/app/lib/pushRegister.ts. The app sends, from its
// account to the daemon inbox, a plain-text DM body:
//   METRO_CTRL:register-push:{json}
// where {json} = { v, token, platform, address:<lowercased>, inboxId }.
const METRO_CTRL_PREFIX = 'METRO_CTRL:';
const CTRL_REGISTER_PUSH = 'register-push';

/** Mirror of the app's `isMetroControlBody` (prefix-only test) so every control
 *  verb — current or future — is filtered out of chat/push. */
function isMetroControlBody(text: unknown): text is string {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

interface RegisterPushPayload { v?: number; token: string; platform?: string; address?: string; inboxId?: string }

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
    } else {
      process.stderr.write(`xmtp[${accountId}]: unknown control verb '${verb}' — swallowed\n`);
    }
  } catch (err) {
    process.stderr.write(`xmtp[${accountId}]: control DM '${verb}' FAILED: ${(err as Error).message}\n`);
  }
  return true;
}

