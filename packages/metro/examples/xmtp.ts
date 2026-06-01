/**
 * XMTP train — MULTI-ACCOUNT (P1, LIVE since 2026-05-29).
 *
 * Activated: boots accounts from ~/.metro/xmtp-accounts.json. The previous
 * single-account train is at ~/.metro/trains/xmtp.ts.bak (rollback: restore it
 * + `metro trains restart xmtp`). See /tmp/p1-design/RUNBOOK.md.
 *
 * Difference from the single-account train:
 *   - Boots N XMTP Clients from ~/.metro/xmtp-accounts.json (one per account).
 *   - Lines are account-scoped: metro://xmtp/<accountId>/<convId>.
 *     Legacy metro://xmtp/<convId> still parses (→ the `default` account).
 *   - Every inbound event carries payload.account = <accountId> and, if the
 *     account declares an `owner`, sets `to` = owner so a session tailing
 *     `--as=<owner>` receives only that account's feed (feed isolation, no core
 *     change). See DESIGN.md §3.4.
 *   - Outbound actions take an optional `account` (else inferred from the line).
 *   - FCM tokens may be scoped to an account.
 *
 * Back-compat: if xmtp-accounts.json is absent, synthesizes a single `default`
 * account from $XMTP_PRIVATE_KEY / $XMTP_ENV — behaves like the old train.
 *
 * Account signing key resolution (per entry, exactly one of):
 *   - { privateKey: "0x…" }  → raw EOA key. Account 0 = the EXISTING
 *     XMTP_PRIVATE_KEY so the current identity/inbox/conversations are preserved.
 *   - { derive: <index> }    → key is derived from a stored BIP-39 mnemonic via
 *     viem mnemonicToAccount(mnemonic, { addressIndex: <index> }), HD path
 *     m/44'/60'/0'/0/<index>. The mnemonic is read from XMTP_MNEMONIC or, by
 *     default, ~/.metro/xmtp-mnemonic (mode 0600). This is a NEW secret used
 *     ONLY for derived puppet/extra accounts; it is NOT the daemon key. By
 *     convention derived accounts use index >= 1 (index 0 of the mnemonic is
 *     reserved/unused since account 0 rides the existing raw key).
 *
 * ──────────── PUSH (LIVE 2026-05-29, see /tmp/metro-agents/PUSH-DESIGN.md) ────────────
 *   Wire format is the SINGLE SOURCE OF TRUTH from the mobile app
 *   (apps/app/lib/pushRegister.ts on PR #135). The daemon parses EXACTLY what
 *   the app sends — do not diverge.
 *
 *   CONTROL DM (inbound, plain-text XMTP message, default content type):
 *       METRO_CTRL:register-push:{json}
 *     where {json} is a single-line object:
 *       { "v":1, "token":"<fcm/apns token>",
 *         "platform":"android"|"ios",
 *         "address":"0x…"(lowercased), "inboxId":"<hex>" }
 *
 *   F2 — control-DM handling (inbound): any inbound plain-text body starting
 *        with `METRO_CTRL:` is a private control payload, NOT chat. It is
 *        consumed daemon-side and NEVER surfaced as a chat event / owner feed
 *        item and never triggers a push. For the `register-push` verb, the
 *        token is stored scoped to the RECEIVING daemon accountId, using
 *        `msg.senderInboxId` as the authoritative inboxId (the payload's
 *        `address`/`inboxId` are kept for verification/audit only). The CLI
 *        `register-push` action keeps working unchanged.
 *   F1 — push on INBOUND: for every real inbound message (own/echo +
 *        SILENT_TYPES + control DMs already skipped) the stream loop fans out an
 *        FCM push to the RECEIVING account's registered tokens.
 *   E1 — per-account scoping: the inbound fan-out passes the receiving account
 *        id to fcmPushToAll(), which filters tokens to that account.
 */

import {
  Client, ConsentState, IdentifierKind,
  type Conversation, type DecodedMessage, type Signer,
} from '@xmtp/node-sdk';
import { ContentTypeReaction, ReactionCodec, type Reaction } from '@xmtp/content-type-reaction';
import { ReactionAction, ReactionSchema } from '@xmtp/node-sdk';
import { ContentTypeReply, ReplyCodec, type Reply } from '@xmtp/content-type-reply';
import {
  AttachmentCodec, ContentTypeAttachment, RemoteAttachmentCodec,
  type Attachment,
} from '@xmtp/content-type-remote-attachment';
import { ContentTypeId, type ContentCodec, type EncodedContent } from '@xmtp/content-type-primitives';
import { WalletSendCallsCodec, type WalletSendCallsParams } from '@xmtp/content-type-wallet-send-calls';
import { TransactionReferenceCodec, type TransactionReference } from '@xmtp/content-type-transaction-reference';
const ContentTypePoll = new ContentTypeId({ authorityId: 'metro.box', typeId: 'poll', versionMajor: 1, versionMinor: 0 });
type PollContent = { question: string; options?: string[]; [k: string]: unknown };
class PollCodec implements ContentCodec<PollContent> {
  get contentType() { return ContentTypePoll; }
  encode(c: PollContent): EncodedContent { return { type: ContentTypePoll, parameters: {}, fallback: `📊 Poll: ${c.question}`, content: new TextEncoder().encode(JSON.stringify(c)) }; }
  decode(e: EncodedContent): PollContent { return JSON.parse(new TextDecoder().decode(e.content)) as PollContent; }
  fallback(c: PollContent) { return `📊 Poll: ${c.question}`; }
  shouldPush() { return true; }
}

/* Metro signature content types — `metro.box/signatureRequest:1.0` (a request to
 * sign EIP-712 typed data or a personal_sign string) + `metro.box/signatureReference:1.0`
 * (the signature posted back). Mirror the inline PollCodec: JSON encode/decode. */
const ContentTypeSignatureRequest = new ContentTypeId({ authorityId: 'metro.box', typeId: 'signatureRequest', versionMajor: 1, versionMinor: 0 });
type SignatureRequestContent = { id?: string; kind?: 'eip712' | 'personal'; eip712?: unknown; message?: string; description?: string; [k: string]: unknown };
class SignatureRequestCodec implements ContentCodec<SignatureRequestContent> {
  get contentType() { return ContentTypeSignatureRequest; }
  encode(c: SignatureRequestContent): EncodedContent { return { type: ContentTypeSignatureRequest, parameters: {}, fallback: c.description ? `[Signature request] ${c.description}` : '[Signature request]', content: new TextEncoder().encode(JSON.stringify(c)) }; }
  decode(e: EncodedContent): SignatureRequestContent { return JSON.parse(new TextDecoder().decode(e.content)) as SignatureRequestContent; }
  fallback(c: SignatureRequestContent) { return c.description ? `[Signature request] ${c.description}` : '[Signature request]'; }
  shouldPush() { return true; }
}
const ContentTypeSignatureReference = new ContentTypeId({ authorityId: 'metro.box', typeId: 'signatureReference', versionMajor: 1, versionMinor: 0 });
type SignatureReferenceContent = { requestId?: string; signature: string; signer?: string; [k: string]: unknown };
class SignatureReferenceCodec implements ContentCodec<SignatureReferenceContent> {
  get contentType() { return ContentTypeSignatureReference; }
  encode(c: SignatureReferenceContent): EncodedContent { return { type: ContentTypeSignatureReference, parameters: {}, fallback: c.signature ? `[Signature] ${c.signature}` : '[Signature]', content: new TextEncoder().encode(JSON.stringify(c)) }; }
  decode(e: EncodedContent): SignatureReferenceContent { return JSON.parse(new TextDecoder().decode(e.content)) as SignatureReferenceContent; }
  fallback(c: SignatureReferenceContent) { return c.signature ? `[Signature] ${c.signature}` : '[Signature]'; }
  shouldPush() { return true; }
}
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

/* ──────────── account config ──────────── */

const ACCOUNTS_FILE = process.env.XMTP_ACCOUNTS_FILE
  ?? join(homedir(), '.metro', 'xmtp-accounts.json');

type XmtpEnv = 'production' | 'dev' | 'local';
interface AccountConfig {
  id: string;
  /** Signing key, EXACTLY ONE of `privateKey` or `derive`:
   *  - privateKey: raw 0x-prefixed 32-byte hex EOA key (account 0 = existing key).
   *  - derive: HD index into the stored mnemonic (m/44'/60'/0'/0/<index>). */
  privateKey?: string;
  derive?: number;
  env?: XmtpEnv;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
  /** node-sdk local MLS db; defaults to per-account path. */
  dbPath?: string;
}

/** Where the BIP-39 mnemonic for DERIVED accounts lives. New secret, NOT the
 *  daemon key. Read lazily and only if some account uses `derive`. */
const MNEMONIC_FILE = process.env.XMTP_MNEMONIC_FILE
  ?? join(homedir(), '.metro', 'xmtp-mnemonic');

let cachedMnemonic: string | null = null;
function loadMnemonic(): string {
  if (cachedMnemonic) return cachedMnemonic;
  const inline = process.env.XMTP_MNEMONIC?.trim();
  if (inline) { cachedMnemonic = inline; return inline; }
  if (!existsSync(MNEMONIC_FILE)) {
    process.stderr.write(`xmtp: an account uses "derive" but no mnemonic found (set XMTP_MNEMONIC or place ${MNEMONIC_FILE})\n`);
    process.exit(2);
  }
  const m = readFileSync(MNEMONIC_FILE, 'utf8').trim();
  if (!m) { process.stderr.write(`xmtp: ${MNEMONIC_FILE} is empty\n`); process.exit(2); }
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

/** If the default account should keep emitting legacy `metro://xmtp/<conv>` lines
 *  (zero migration for existing claims/deep-links), set XMTP_LEGACY_DEFAULT_LINES=1. */
const LEGACY_DEFAULT_LINES = process.env.XMTP_LEGACY_DEFAULT_LINES === '1';
const ACCOUNT_ALLOWLIST = new Set(
  (process.env.XMTP_ONLY_ACCOUNTS ?? process.env.XMTP_ACCOUNTS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);

function loadAccounts(): AccountConfig[] {
  if (existsSync(ACCOUNTS_FILE)) {
    let raw: AccountConfig[];
    try { raw = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as AccountConfig[]; }
    catch (e) { process.stderr.write(`xmtp: bad ${ACCOUNTS_FILE}: ${(e as Error).message}\n`); process.exit(2); }
    if (!Array.isArray(raw) || raw.length === 0) {
      process.stderr.write(`xmtp: ${ACCOUNTS_FILE} must be a non-empty array\n`); process.exit(2);
    }
    const seen = new Set<string>();
    for (const a of raw) {
      if (!a.id) { process.stderr.write(`xmtp: account missing id\n`); process.exit(2); }
      const hasKey = typeof a.privateKey === 'string' && a.privateKey.length > 0;
      const hasDerive = typeof a.derive === 'number';
      if (hasKey === hasDerive) {
        process.stderr.write(`xmtp: account '${a.id}' must set EXACTLY ONE of privateKey or derive\n`); process.exit(2);
      }
      if (hasDerive && (a.derive! < 0 || !Number.isInteger(a.derive))) {
        process.stderr.write(`xmtp: account '${a.id}' derive must be a non-negative integer\n`); process.exit(2);
      }
      if (seen.has(a.id)) { process.stderr.write(`xmtp: duplicate account id '${a.id}'\n`); process.exit(2); }
      seen.add(a.id);
    }
    const selected = ACCOUNT_ALLOWLIST.size
      ? raw.filter(a => ACCOUNT_ALLOWLIST.has(a.id))
      : raw;
    if (selected.length === 0) {
      process.stderr.write(`xmtp: no accounts match XMTP_ONLY_ACCOUNTS (${[...ACCOUNT_ALLOWLIST].join(', ')})\n`);
      process.exit(2);
    }
    return selected;
  }
  /** Back-compat: single account from env. */
  const pk = process.env.XMTP_PRIVATE_KEY;
  if (!pk) {
    process.stderr.write(`xmtp: no ${ACCOUNTS_FILE} and XMTP_PRIVATE_KEY unset\n`); process.exit(2);
  }
  return [{ id: 'default', privateKey: pk, env: (process.env.XMTP_ENV as XmtpEnv) ?? 'production' }];
}

const expandHome = (p: string): string => p.startsWith('~') ? join(homedir(), p.slice(1)) : p;

/* ──────────── wire helpers ──────────── */

const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');
const respond = (id: string, body: { result?: unknown; error?: string }): void =>
  void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;
const SELF_URI = process.env.METRO_SELF_URI ?? '';

/* ──────────── universal-id ↔ xmtp-id map (#2) ────────────
 * Every event the train emits carries a universal `msg_*` id AND the raw xmtp
 * message_id. We remember that mapping so an agent can pass EITHER id to
 * react/reply/sendAttachment without juggling two id spaces. Bounded LRU-ish:
 * insertion-ordered Map, evict oldest past the cap. */
const UID_MAP_MAX = 5000;
const uidToXmtp = new Map<string, string>();
/** #9: daemon-side inbox→eth cache (mirrors app inboxEthCache) so repeated groupInfo lookups are free. */
const inboxEthCache = new Map<string, string>();
function rememberUid(uid: string | undefined, xmtpId: string | undefined): void {
  if (!uid || !xmtpId || !uid.startsWith('msg_')) return;
  uidToXmtp.set(uid, xmtpId);
  if (uidToXmtp.size > UID_MAP_MAX) {
    const oldest = uidToXmtp.keys().next().value;
    if (oldest !== undefined) uidToXmtp.delete(oldest);
  }
}
/** Resolve a possibly-universal (`msg_*`) id to a raw xmtp message id. A raw
 *  xmtp id passes straight through; an unknown `msg_*` errors clearly. */
function resolveMsgId(rawId: string): string {
  if (!rawId.startsWith('msg_')) return rawId;          // already a raw xmtp id
  const mapped = uidToXmtp.get(rawId);
  if (mapped) return mapped;
  throw new Error(`could not resolve universal id ${rawId} to an xmtp message id (not seen by this train; pass the raw xmtp message_id)`);
}

/** Per-account line. The default account may emit legacy lines for migration. */
function lineOf(accountId: string, convId: string): string {
  if (accountId === 'default' && LEGACY_DEFAULT_LINES) return `metro://xmtp/${convId}`;
  return `metro://xmtp/${accountId}/${convId}`;
}

/** Parse a line back to {accountId, convId}. Accepts new + legacy forms. */
function parseLine(line: string): { accountId: string; convId: string } | null {
  const mNew = line.match(/^metro:\/\/xmtp\/([^/]+)\/([^/]+)$/);
  if (mNew) return { accountId: mNew[1], convId: mNew[2] };
  const mLegacy = line.match(/^metro:\/\/xmtp\/([^/]+)$/);
  if (mLegacy) return { accountId: 'default', convId: mLegacy[1] };
  return null;
}

/* ──────────── whisper transcription (shared) ──────────── */

const WHISPER_BIN = process.env.METRO_WHISPER_BIN ?? 'whisper-cli';
const WHISPER_MODEL = process.env.METRO_WHISPER_MODEL
  ?? `${process.env.HOME}/.cache/whisper-cpp/ggml-base.bin`;
const FFMPEG_BIN = process.env.METRO_FFMPEG_BIN ?? 'ffmpeg';
async function transcribeAndEmit(audio: Uint8Array, line: string, accountId: string, sourceMsgId: string): Promise<void> {
  const { existsSync: ex, readFileSync: rf, writeFileSync: wf, unlinkSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const { spawn } = await import('node:child_process');
  if (!ex(WHISPER_MODEL)) return;
  const dir = mkdtempSync(j(tmpdir(), 'xmtp-tx-'));
  const inFile = j(dir, 'in.m4a'); const wav = j(dir, 'in.wav'); const out = j(dir, 'in');
  const run = (bin: string, args: string[]): Promise<void> => new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: 'ignore' });
    p.on('error', rej); p.on('exit', c => c === 0 ? res() : rej(new Error(`${bin} ${c}`)));
  });
  try {
    wf(inFile, audio);
    await run(FFMPEG_BIN, ['-y', '-i', inFile, '-ar', '16000', '-ac', '1', wav]);
    await run(WHISPER_BIN, ['-m', WHISPER_MODEL, '-f', wav, '--output-txt', '-of', out]);
    const text = rf(`${out}.txt`, 'utf8').trim();
    if (!text) return;
    emitInbound(accountId, {
      id: mintId(), ts: new Date().toISOString(), station: 'xmtp', line, from: SELF_URI,
      text: `🎙️ ${text}`,
      payload: { contentType: 'transcript', transcribeFor: sourceMsgId, transcript: text },
    });
  } catch (err) { process.stderr.write(`xmtp transcribe failed: ${(err as Error).message}\n`); }
  finally { for (const f of [inFile, wav, `${out}.txt`]) { try { unlinkSync(f); } catch { /* ignore */ } } }
}

/* ──────────── FCM push (shared, optionally account-scoped) ──────────── */

const FCM_SVC_PATH = `${process.env.HOME}/.config/metro/firebase-service-account.json`;
const FCM_TOKENS_PATH = `${process.env.HOME}/.cache/metro/xmtp-push-tokens.json`;
interface FcmServiceAccount { client_email: string; private_key: string; project_id: string; token_uri: string }
/** Per-device push token. `account` scopes it to a daemon accountId (privacy:
 *  a device only receives pushes for the account it registered). `inboxId` /
 *  `platform` / `lastSeenAt` are recorded for verification + token hygiene
 *  (see PUSH-DESIGN §3.2). Legacy rows may have only {token, registeredAt}. */
interface StoredPushToken {
  token: string;
  registeredAt: string;
  account?: string;
  inboxId?: string;             // most-recent registering inbox (back-compat / primary)
  inboxIds?: string[];          // ALL inboxes that have registered this device-token —
                                // a multi-account device is "self" for every one of them
  platform?: string;
  lastSeenAt?: string;
}

function loadFcmSvc(): FcmServiceAccount | null {
  if (!existsSync(FCM_SVC_PATH)) return null;
  try { return JSON.parse(readFileSync(FCM_SVC_PATH, 'utf8')) as FcmServiceAccount; }
  catch (err) { process.stderr.write(`fcm: bad service account: ${(err as Error).message}\n`); return null; }
}
function loadPushTokens(): StoredPushToken[] {
  if (!existsSync(FCM_TOKENS_PATH)) return [];
  try { return JSON.parse(readFileSync(FCM_TOKENS_PATH, 'utf8')) as StoredPushToken[]; }
  catch { return []; }
}
function savePushTokens(tokens: StoredPushToken[]): void {
  mkdirSync(dirname(FCM_TOKENS_PATH), { recursive: true });
  writeFileSync(FCM_TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

/** Upsert a device token (deduped by token). Used by both the CLI `register-push`
 *  action and the inbound control-DM branch (F2). Replaces any existing row for
 *  the same token, refreshing scope + lastSeenAt. Returns the new total count. */
function storePushToken(entry: {
  token: string; account?: string; inboxId?: string; platform?: string;
}): number {
  const now = new Date().toISOString();
  const all = loadPushTokens();
  const existing = all.find(t => t.token === entry.token);
  const remaining = all.filter(t => t.token !== entry.token);
  // Accumulate inbox ids across account switches on the same device: a phone that
  // registers multiple accounts keeps ONE FCM token, so carry forward every inbox
  // it has registered. The daemon then treats a message from ANY of them as the
  // device's own → never self-notifies (was: each re-register replaced the row,
  // dropping prior inboxes so only the latest counted as self).
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
  const payload = { iss: svc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: svc.token_uri, iat: now, exp: now + 3600 };
  const sigInput = `${enc(header)}.${enc(payload)}`;
  const signer = createSign('RSA-SHA256'); signer.update(sigInput); signer.end();
  const sig = signer.sign(svc.private_key).toString('base64url');
  const jwt = `${sigInput}.${sig}`;
  const res = await fetch(svc.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) { process.stderr.write(`fcm token exchange ${res.status}: ${await res.text()}\n`); return null; }
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedAccessToken.token;
}
async function fcmPushTo(deviceToken: string, title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  const svc = loadFcmSvc(); if (!svc) return;
  const at = await fcmAccessToken(); if (!at) return;
  const url = `https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`;
  // DATA-ONLY high-priority message — NO top-level `notification` block. The new
  // APK's native MetroFcmService builds the notification itself (Telegram-style
  // round-avatar largeIcon on the left) from data.{title,body,avatarUrl,channelId}.
  // A notification block would let the system auto-display a plain notif and the
  // native handler wouldn't run while backgrounded. title/body/avatarUrl are passed
  // in via `data`; for control/test pushes avatarUrl is simply absent and the
  // native service falls back to a plain notification.
  const payloadData: Record<string, string> = {
    channelId: 'xmtp',
    ...data,
    title: String(title),
    body: String(body),
  };
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
    body: JSON.stringify({ message: { token: deviceToken, android: { priority: 'HIGH' }, data: payloadData } }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // Only UNREGISTERED / NOT_FOUND mean the device token is dead → prune it.
    // INVALID_ARGUMENT is a MALFORMED-PAYLOAD signal (e.g. a bad image URL), NOT a
    // stale token — pruning on it permanently kills a perfectly good device.
    if (txt.includes('UNREGISTERED') || txt.includes('NOT_FOUND')) {
      savePushTokens(loadPushTokens().filter(t => t.token !== deviceToken));
      process.stderr.write(`fcm: pruned stale token ${deviceToken.slice(0, 12)}…\n`); return;
    }
    process.stderr.write(`fcm push ${res.status}: ${txt}\n`);
  }
}
/** Push to every token, or only those scoped to (or unscoped for) `accountId`. */
async function fcmPushToAll(accountId: string, title: string, body: string, data: Record<string, string> = {}, excludeInboxId?: string): Promise<void> {
  // Scope to the account, and skip the sender's OWN device(s): a phone registered
  // under this account should never be pushed for a message it just sent (you don't
  // get notified for your own message). Sender match is by stored inboxId.
  const tokens = loadPushTokens().filter(t => {
    if (t.account && t.account !== accountId) return false;
    // Skip the sender's OWN device — match against every inbox the device registered.
    if (excludeInboxId && (t.inboxId === excludeInboxId || t.inboxIds?.includes(excludeInboxId))) return false;
    return true;
  });
  if (tokens.length === 0) return;
  await Promise.all(tokens.map(t => fcmPushTo(t.token, title, body, { ...data, account: accountId }).catch(() => undefined)));
}

/* ──────────── control DM (inbound, F2) — wire format from PR #135 ────────────
 *  SINGLE SOURCE OF TRUTH: apps/app/lib/pushRegister.ts. The app sends, from its
 *  own account to the daemon's inbox, a default-content-type plain-text XMTP DM
 *  whose body is:
 *       METRO_CTRL:register-push:{json}
 *  where {json} = { v:1, token, platform:"android"|"ios",
 *                   address:<lowercased>, inboxId:<hex> }
 *  Detection mirrors the app's `isMetroControlBody` EXACTLY (prefix-only test on
 *  `METRO_CTRL:`) so ANY current/future control verb is suppressed from chat. */

/** Magic prefix marking a plain-text XMTP body as a private control payload
 *  rather than chat. MUST equal METRO_CTRL_PREFIX in apps/app/lib/pushRegister.ts. */
const METRO_CTRL_PREFIX = 'METRO_CTRL:';
/** The register-push verb. Full body = `${METRO_CTRL_PREFIX}register-push:${json}`. */
const CTRL_REGISTER_PUSH = 'register-push';

/** Mirror of the app's `isMetroControlBody`: a string body that begins with the
 *  control prefix. Deliberately broad (prefix only) so every control verb is
 *  filtered out of the feed/push, even verbs added later. */
function isMetroControlBody(text: unknown): text is string {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

/** The register-push JSON payload as the app serialises it. `address`/`inboxId`
 *  are for verification/audit only; the stored inboxId is the SENDER's inbox. */
interface RegisterPushPayload { v?: number; token: string; platform?: string; address?: string; inboxId?: string }

/** Handle an inbound control DM. Returns true iff the message was a control DM
 *  (and therefore must NOT be surfaced as chat or trigger a push). Only the
 *  `register-push` verb has an effect today; other/unknown verbs are still
 *  swallowed (returns true) so they never leak into the feed. Best-effort:
 *  never throws into the stream loop. */
function handleControlDm(accountId: string, msg: DecodedMessage): boolean {
  const body = msg.content;
  if (!isMetroControlBody(body)) return false;
  // Strip the prefix and read the verb up to the first ':' (verb args follow).
  const rest = body.slice(METRO_CTRL_PREFIX.length);     // e.g. "register-push:{...}"
  const sep = rest.indexOf(':');
  const verb = sep === -1 ? rest : rest.slice(0, sep);
  const arg = sep === -1 ? '' : rest.slice(sep + 1);     // the {json} remainder
  try {
    if (verb === CTRL_REGISTER_PUSH) {
      const obj = JSON.parse(arg) as Partial<RegisterPushPayload>;
      if (!obj || typeof obj.token !== 'string' || obj.token.length < 20) {
        process.stderr.write(`xmtp[${accountId}]: register-push (ctrl-dm) ignored — bad/short token\n`);
        return true; // still a control DM; do not surface
      }
      const total = storePushToken({
        token: obj.token,
        account: accountId,                              // RECEIVING daemon account
        inboxId: msg.senderInboxId,                      // SENDER inbox = authoritative
        platform: typeof obj.platform === 'string' ? obj.platform : undefined,
      });
      process.stderr.write(`xmtp[${accountId}]: register-push (ctrl-dm) stored token ${obj.token.slice(0, 12)}… from inbox ${msg.senderInboxId.slice(0, 10)}… (v=${obj.v ?? '?'}, ${total} total)\n`);
    } else {
      process.stderr.write(`xmtp[${accountId}]: unknown control verb '${verb}' — swallowed\n`);
    }
  } catch (err) {
    process.stderr.write(`xmtp[${accountId}]: control DM '${verb}' FAILED: ${(err as Error).message}\n`);
  }
  return true;
}

/* ──────────── per-account client boot ──────────── */

interface Account {
  cfg: AccountConfig;
  client: Client;
  inboxId: string;
  address: string;
}
const accounts = new Map<string, Account>();

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

const CODECS = () => [new ReactionCodec(), new ReplyCodec(), new AttachmentCodec(), new RemoteAttachmentCodec(), new PollCodec(), new WalletSendCallsCodec(), new TransactionReferenceCodec(), new SignatureRequestCodec(), new SignatureReferenceCodec()];

async function bootAccount(cfg: AccountConfig): Promise<void> {
  const env = (cfg.env ?? 'production') as XmtpEnv;
  const { signer, address } = signerFor(resolvePrivateKey(cfg));
  const dbPath = expandHome(cfg.dbPath ?? join(homedir(), '.metro', `xmtp-${env}-${cfg.id}.db3`));
  const client = await Client.create(signer, { env, codecs: CODECS(), dbPath });
  accounts.set(cfg.id, { cfg, client, inboxId: client.inboxId, address });
  process.stderr.write(`xmtp[${cfg.id}] ready — inbox ${client.inboxId} (${address}, env=${env}, owner=${cfg.owner ?? '(broadcast)'})\n`);
}

/* ──────────── inbound emission (account-tagged + owner-routed) ──────────── */

/** Wrap emit: stamp account into payload and route `to` to the account owner. */
function emitInbound(accountId: string, e: Record<string, unknown>): void {
  const acct = accounts.get(accountId);
  const owner = acct?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ kind: 'inbound', ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}

function envelope(accountId: string, msg: DecodedMessage, conv: Conversation): Record<string, unknown> {
  const senderInbox = msg.senderInboxId;
  const typeId = msg.contentType?.typeId;
  const c = msg.content;
  const line = lineOf(accountId, conv.id);
  const base = {
    id: mintId(), ts: msg.sentAt.toISOString(), station: 'xmtp', line,
    from: `metro://xmtp/${accountId}/user/${senderInbox}`, message_id: msg.id,
  };
  rememberUid(base.id, msg.id);
  if (typeof c === 'string') return { ...base, text: c, payload: { contentType: typeId } };
  if (typeId === 'reaction' && c && typeof c === 'object') {
    const r = c as Reaction;
    /** node-sdk decodes action/schema as either the string form ('added'/'unicode')
     *  or the numeric bindings enum (1/2/3). Normalise to lowercase strings so the
     *  app can read payload.schema/action regardless. */
    const schemaStr = (() => {
      const s = (r as { schema?: unknown }).schema;
      if (typeof s === 'string') return s.toLowerCase();
      if (s === 3) return 'custom'; if (s === 2) return 'shortcode'; if (s === 1) return 'unicode';
      return undefined;
    })();
    const actionStr = (() => {
      const a = (r as { action?: unknown }).action;
      if (typeof a === 'string') return a.toLowerCase();
      if (a === 2) return 'removed'; if (a === 1) return 'added';
      return undefined;
    })();
    const removed = actionStr === 'removed';
    return { ...base, text: `[react ${r.content ?? ''}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, content: r.content,
        schema: schemaStr, action: actionStr, removed,
        optionIndex: schemaStr === 'custom' ? Number(r.content) : undefined } };
  }
  if (typeId === 'reply' && c && typeof c === 'object') {
    const r = c as Reply;
    return { ...base, text: typeof r.content === 'string' ? r.content : `[reply with ${r.contentType?.typeId ?? 'unknown'}]`,
      payload: { contentType: typeId, replyTo: r.reference, replyContentType: r.contentType?.typeId } };
  }
  if (typeId === 'attachment' && c && typeof c === 'object') {
    const a = c as { filename?: string; mimeType: string; content: Uint8Array };
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    const dataB64 = Buffer.from(a.content).toString('base64');
    const out = { ...base, text: `[${kind}: ${a.filename ?? 'attachment'}]`,
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64 }] } };
    if (kind === 'audio') void transcribeAndEmit(a.content, line, accountId, base.id);
    return out;
  }
  if (typeId === 'remoteStaticAttachment' && c && typeof c === 'object') {
    const r = c as { url: string; filename?: string; contentDigest?: string; nonce?: Uint8Array; salt?: Uint8Array; secret?: Uint8Array; scheme?: string; contentLength?: number };
    const kind = r.url.match(/\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i) ? 'image' : 'file';
    return { ...base, text: `[${kind}: ${r.filename ?? r.url}]`,
      payload: { contentType: typeId, attachments: [{ kind, url: r.url, name: r.filename, size: r.contentLength,
        remote: { contentDigest: r.contentDigest,
          nonce: r.nonce ? Buffer.from(r.nonce).toString('base64') : undefined,
          salt: r.salt ? Buffer.from(r.salt).toString('base64') : undefined,
          secret: r.secret ? Buffer.from(r.secret).toString('base64') : undefined,
          scheme: r.scheme } }] } };
  }
  if ((typeId === 'multiRemoteStaticAttachment' || typeId === 'multiRemoteAttachment') && c && typeof c === 'object') {
    /** libxmtp natively decodes a `multiRemoteAttachment` message into
     *  `{ attachments: RemoteAttachment[] }`. Map each entry into the same
     *  `payload.attachments[]` shape the single remoteStaticAttachment branch
     *  emits so the app's gallery renderer (RemoteAttachmentResolver) can
     *  download+decrypt each one. Without this the body fell through to the
     *  `[… payload]` placeholder and the bytes were lost. */
    const m = c as { attachments?: Array<{ url: string; filename?: string; contentDigest?: string; nonce?: Uint8Array; salt?: Uint8Array; secret?: Uint8Array; scheme?: string; contentLength?: number }> };
    const list = Array.isArray(m.attachments) ? m.attachments : [];
    const attachments = list.map((r) => {
      const isImg = r.url.match(/\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i) || (r.filename ?? '').match(/\.(png|jpg|jpeg|gif|webp|heic)$/i);
      const isVid = r.url.match(/\.(mp4|mov|webm|m4v)(\?|$)/i) || (r.filename ?? '').match(/\.(mp4|mov|webm|m4v)$/i);
      const kind = isImg ? 'image' : isVid ? 'video' : 'file';
      return { kind, url: r.url, name: r.filename, size: r.contentLength,
        remote: { contentDigest: r.contentDigest,
          nonce: r.nonce ? Buffer.from(r.nonce).toString('base64') : undefined,
          salt: r.salt ? Buffer.from(r.salt).toString('base64') : undefined,
          secret: r.secret ? Buffer.from(r.secret).toString('base64') : undefined,
          scheme: r.scheme } };
    });
    const imgCount = attachments.filter((a) => a.kind === 'image').length;
    const vidCount = attachments.filter((a) => a.kind === 'video').length;
    const text = imgCount === attachments.length && imgCount > 1 ? `📷 ${imgCount} photos`
      : vidCount === attachments.length && vidCount > 1 ? `🎥 ${vidCount} videos`
        : attachments.length === 1 ? (attachments[0]!.kind === 'video' ? `🎥 ${attachments[0]!.name ?? 'video'}` : `[${attachments[0]!.kind}: ${attachments[0]!.name ?? attachments[0]!.url}]`)
          : `📎 ${attachments.length} attachments`;
    return { ...base, text, payload: { contentType: typeId, attachments } };
  }
  if (typeId === 'poll' && c && typeof c === 'object') {
    const p = c as { question?: string };
    return { ...base, text: `Poll: ${p.question ?? ''}`, payload: { contentType: typeId, poll: c } };
  }
  if (typeId === 'walletSendCalls' && c && typeof c === 'object') {
    return { ...base, text: 'Payment request', payload: { contentType: typeId, walletSendCalls: c as WalletSendCallsParams } };
  }
  if (typeId === 'transactionReference' && c && typeof c === 'object') {
    return { ...base, text: 'Transaction', payload: { contentType: typeId, transactionReference: c as TransactionReference } };
  }
  if (typeId === 'signatureRequest' && c && typeof c === 'object') {
    return { ...base, text: 'Signature request', payload: { contentType: typeId, signatureRequest: c } };
  }
  if (typeId === 'signatureReference' && c && typeof c === 'object') {
    return { ...base, text: 'Signature', payload: { contentType: typeId, signatureReference: c } };
  }
  return { ...base, text: `[${typeId ?? 'unknown'} payload]`, payload: { contentType: typeId } };
}

/** Format a preview string for a push-notification body: a reaction shows just its
 *  emoji ("[react 🔥]" → "🔥"), a voice/audio attachment shows a mic ("[audio:
 *  voice-….m4a]" → "🎤"). Everything else is unchanged. The raw envelope text keeps
 *  its "[react …]" / "[audio: …]" form for the event log + chat bubbles. */
function humanizePushPreview(t: string): string {
  const react = /^\[react (.+?)(?: \(removed\))?\]$/.exec(t);
  if (react) return react[1];
  if (/^\[audio[:\]]/.test(t)) return '🎤';
  return t;
}

function emitOutbound(accountId: string, line: string, messageId: string, text: string): void {
  const uid = mintId();
  rememberUid(uid, messageId);
  emit({ kind: 'outbound', id: uid, ts: new Date().toISOString(), station: 'xmtp',
    line, from: SELF_URI, to: line, message_id: messageId, text, account: accountId,
    payload: { account: accountId } });
  const preview0 = humanizePushPreview(text);
  const preview = preview0.length > 140 ? `${preview0.slice(0, 137)}…` : preview0;
  // Notify the recipient device(s) of this account's outbound message, titled with
  // the SENDER's resolved profile name (e.g. "Tony") — not a generic "New message".
  void (async (): Promise<void> => {
    const addr = accounts.get(accountId)?.address ?? '';
    const name = addr ? await resolveProfileName(addr) : '';
    const title = name || (addr ? shortAddr(addr) : 'New message');
    const data: Record<string, string> = { line, messageId };
    { const p = parseLine(line); if (p) data.convId = p.convId; }
    if (addr) data.avatarUrl = `https://stamp.fyi/avatar/eth:${addr}?s=128`;
    await fcmPushToAll(accountId, title, preview, data);
  })().catch(() => undefined);
}

/* ──────────── inbound push fan-out (F1, account-scoped via E1) ──────────── */

/** Lazy inbox→address cache for push titles. Resolves ONE inbox per cache miss
 *  (NOT all members at once — that bulk path caused the rate-limit outage; see
 *  MEMORY "XMTP rate limit"). Each unique sender costs a single fetchInboxStates
 *  call, then is cached for the process lifetime. Best-effort: '' on failure. */
const inboxAddrCache = new Map<string, string>();
async function resolveInboxAddress(accountId: string, inboxId: string): Promise<string> {
  if (!inboxId) return '';
  const hit = inboxAddrCache.get(inboxId);
  if (hit !== undefined) return hit;
  let addr = '';
  try {
    const client = accounts.get(accountId)?.client;
    if (client) {
      const states = await client.preferences.fetchInboxStates([inboxId]);
      const eth = states[0]?.identifiers.find((it: { identifierKind: IdentifierKind }) => it.identifierKind === IdentifierKind.Ethereum);
      addr = eth?.identifier ?? '';
    }
  } catch { /* best-effort — fall back to inbox prefix */ }
  inboxAddrCache.set(inboxId, addr);
  return addr;
}
const shortAddr = (a: string): string => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Lazy address→Snapshot-profile-name cache for push titles. Mirrors the app's
 *  profile lookup (hub.snapshot.org `user(id){name}`) so notifications show the
 *  sender's username when they have one, falling back to the short address. One
 *  hub fetch per unique address, then cached for the process lifetime ('' = no
 *  name). Best-effort: '' on any failure. */
const SNAPSHOT_HUB_GRAPHQL = 'https://hub.snapshot.org/graphql';
const profileNameCache = new Map<string, string>();
async function resolveProfileName(address: string): Promise<string> {
  const key = address.toLowerCase();
  const hit = profileNameCache.get(key);
  if (hit !== undefined) return hit;
  let name = '';
  try {
    const res = await fetch(SNAPSHOT_HUB_GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query U($id:String!){user(id:$id){name}}', variables: { id: key } }),
    });
    if (res.ok) {
      const j = await res.json() as { data?: { user?: { name?: string } } };
      name = (j.data?.user?.name ?? '').trim();
    }
  } catch { /* best-effort — fall back to address */ }
  profileNameCache.set(key, name);
  return name;
}

/** Notification copy for an inbound message. Title = the sender's wallet address
 *  (resolved + cached, short form) so the notification names who it's from rather
 *  than an opaque inbox hash; falls back to the inbox prefix if unresolved. Body =
 *  140-char preview mirroring emitOutbound. */
async function pushTitleBody(accountId: string, env: Record<string, unknown>, msg: DecodedMessage): Promise<{ title: string; body: string; avatarUrl?: string }> {
  const ptyId = msg.contentType?.typeId;
  const raw = ptyId === 'walletSendCalls' ? '💸 Payment request'
    : ptyId === 'transactionReference' ? '🧾 Transaction'
      : ptyId === 'signatureRequest' ? '✍️ Signature request'
        : ptyId === 'signatureReference' ? '✍️ Signature'
          : humanizePushPreview(typeof env.text === 'string' ? env.text : '');
  const body = raw.length > 140 ? `${raw.slice(0, 137)}…` : (raw || 'New message');
  const addr = await resolveInboxAddress(accountId, msg.senderInboxId ?? '');
  // Prefer the sender's profile username; fall back to short address; finally
  // the inbox prefix if nothing resolves.
  const name = addr ? await resolveProfileName(addr) : '';
  const title = name
    || (addr ? shortAddr(addr)
      : (msg.senderInboxId ? `${msg.senderInboxId.slice(0, 6)}…${msg.senderInboxId.slice(-4)}` : 'New message'));
  // Sender avatar for the native APK's Telegram-style circular largeIcon. Passed as
  // data.avatarUrl; MetroFcmService loads it client-side into
  // NotificationCompat.Builder.setLargeIcon().
  const avatarUrl = addr ? `https://stamp.fyi/avatar/eth:${addr}?s=128` : undefined;
  return { title, body, avatarUrl };
}

/** F1 + E1: fan out an FCM push to the RECEIVING account's registered tokens for
 *  a real inbound message. Caller guarantees own/echo + SILENT_TYPES + control
 *  DMs are already filtered. fcmPushToAll(accountId) scopes to that account and
 *  skips the sender's own device(s) so you never get pushed for your own message. */
function pushInbound(accountId: string, env: Record<string, unknown>, msg: DecodedMessage, conv?: unknown): void {
  const line = typeof env.line === 'string' ? env.line : '';
  const messageId = typeof env.message_id === 'string' ? env.message_id : (typeof env.id === 'string' ? env.id : '');
  void (async (): Promise<void> => {
    const { title, body, avatarUrl } = await pushTitleBody(accountId, env, msg);
    const data: Record<string, string> = { line, messageId };
    { const p = parseLine(line); if (p) data.convId = p.convId; }
    if (avatarUrl) data.avatarUrl = avatarUrl;
    // Group rendering hints for MetroFcmService's merged group-conversation card.
    // Group detection reuses the listConvs/groupInfo pattern: DMs expose a
    // peerInboxId() method; groups don't. Group title = conv.name (string or
    // async fn), same resolution as listConvs/groupInfo. FCM data is string-only.
    if (conv) {
      const isDm = typeof (conv as { peerInboxId?: unknown }).peerInboxId === 'function';
      if (!isDm) {
        data.isGroup = 'true';
        const gn = (conv as { name?: string | (() => Promise<string>) }).name;
        const resolvedName = typeof gn === 'function' ? await gn().catch(() => '') : (gn ?? '');
        if (resolvedName) data.groupTitle = resolvedName;
      }
    }
    await fcmPushToAll(accountId, title, body, data, msg.senderInboxId);
  })().catch(() => undefined);
}

/* ──────────── routing: line/account → client + conversation ──────────── */

function accountForCall(args: { account?: string; line?: string }): Account {
  let id = args.account;
  if (!id && args.line) id = parseLine(args.line)?.accountId;
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  const acct = accounts.get(id);
  if (!acct) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return acct;
}
async function convOf(line: string): Promise<{ acct: Account; conv: Conversation | undefined }> {
  const parsed = parseLine(line);
  if (!parsed) throw new Error(`bad xmtp line: ${line}`);
  const acct = accounts.get(parsed.accountId);
  if (!acct) throw new Error(`unknown account '${parsed.accountId}' in line ${line}`);
  return { acct, conv: await acct.client.conversations.getConversationById(parsed.convId) };
}

/* ──────────── outbound action handler ──────────── */

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };
async function handleCall({ id, action, args }: CallMsg): Promise<void> {
  try {
    if (action === 'accounts') {
      respond(id, { result: { accounts: [...accounts.values()].map(a => ({
        id: a.cfg.id, address: a.address, inboxId: a.inboxId, env: a.cfg.env ?? 'production',
        owner: a.cfg.owner ?? null,
        keySource: typeof a.cfg.derive === 'number' ? `derive:${a.cfg.derive}` : 'privateKey' })) } });
    } else if (action === 'send') {
      const { line, text } = args as { line: string; text: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const messageId = await conv.sendText(text);
      emitOutbound(acct.cfg.id, line, messageId, text);
      respond(id, { result: { messageId } });
    } else if (action === 'sendPoll') {
      const { line, question, options, header, multiSelect, pollId } = args as {
        line: string; question: string;
        options: (string | { label: string; description?: string })[];
        header?: string; multiSelect?: boolean; pollId?: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      if (!question || typeof question !== 'string') throw new Error('sendPoll requires a question');
      if (!Array.isArray(options) || options.length === 0) throw new Error('sendPoll requires a non-empty options array');
      const normOptions = options.map(o => typeof o === 'string' ? { label: o } : { label: o.label, description: o.description });
      const mintedId = pollId ?? (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `poll_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      const pollContent: PollContent = {
        question, options: normOptions as unknown as string[], multiSelect: !!multiSelect, pollId: mintedId,
        ...(header ? { header } : {}) };
      const sentId = await conv.send(new PollCodec().encode(pollContent));
      emitOutbound(acct.cfg.id, line, sentId, `📊 Poll: ${question}`);
      respond(id, { result: { messageId: sentId, pollId: mintedId } });
    } else if (action === 'react') {
      const { line, messageId, emoji, action: reactAction, schema: reactSchema } = args as {
        line: string; messageId: string; emoji: string; action?: 'added' | 'removed'; schema?: string; referenceInboxId?: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      /** #2: accept a universal msg_* id as well as a raw xmtp id. */
      const xmtpMsgId = resolveMsgId(messageId);
      let refInbox = (args as { referenceInboxId?: string }).referenceInboxId;
      if (!refInbox) {
        /** #9: bounded — search recent messages (newest first) instead of the whole history. */
        const found = (await conv.messages({ limit: 200, direction: 1 } as Parameters<typeof conv.messages>[0])).find(m => m.id === xmtpMsgId);
        refInbox = found?.senderInboxId;
        if (!refInbox) throw new Error(`could not resolve referenceInboxId for ${xmtpMsgId}`);
      }
      /** A poll vote is cast as a custom-schema reaction whose content is the option
       *  index. Default (no schema) stays a plain unicode emoji reaction. */
      const schemaEnum = reactSchema === 'custom' ? ReactionSchema.Custom
        : reactSchema === 'shortcode' ? ReactionSchema.Shortcode
        : ReactionSchema.Unicode;
      const sentId = await conv.sendReaction({
        reference: xmtpMsgId, referenceInboxId: refInbox,
        action: reactAction === 'removed' ? ReactionAction.Removed : ReactionAction.Added,
        content: emoji, schema: schemaEnum });
      emitOutbound(acct.cfg.id, line, sentId, `[react ${emoji}${reactAction === 'removed' ? ' (removed)' : ''}]`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'reply') {
      const { line, replyTo, text } = args as { line: string; replyTo: string; text: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const { encodeText } = await import('@xmtp/node-bindings');
      /** #2: accept a universal msg_* id as well as a raw xmtp id. */
      const xmtpReplyTo = resolveMsgId(replyTo);
      const sentId = await conv.sendReply({
        reference: xmtpReplyTo, content: encodeText(text),
        contentType: { authorityId: 'xmtp.org', typeId: 'text', versionMajor: 1, versionMinor: 0 } } as unknown as Reply);
      emitOutbound(acct.cfg.id, line, sentId, text);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'sendAttachment') {
      const { line, name, mime, dataB64 } = args as { line: string; name: string; mime: string; dataB64: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const sentId = await conv.sendAttachment({
        filename: name, mimeType: mime, content: new Uint8Array(Buffer.from(dataB64, 'base64')) } as unknown as Attachment);
      emitOutbound(acct.cfg.id, line, sentId, `[${mime.split('/')[0]}: ${name}]`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'sendImage') {
      const { line, path, dataB64, filename, mimeType } = args as {
        line: string; path?: string; dataB64?: string; filename?: string; mimeType?: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      let bytes: Uint8Array;
      if (path) {
        const { readFileSync } = await import('node:fs');
        bytes = new Uint8Array(readFileSync(path));
      } else if (dataB64) {
        bytes = new Uint8Array(Buffer.from(dataB64, 'base64'));
      } else {
        throw new Error('sendImage requires path or dataB64');
      }
      const ext = (filename ?? path ?? '').toLowerCase().split('.').pop() ?? '';
      const mime = mimeType ?? (
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
        ext === 'gif' ? 'image/gif' :
        ext === 'webp' ? 'image/webp' : 'image/png');
      const fname = filename ?? (path ? (path.split('/').pop() || 'image.png') : 'image.png');
      const attachment: Attachment = { filename: fname, mimeType: mime, data: bytes };
      const sentId = await conv.send(new AttachmentCodec().encode(attachment));
      emitOutbound(acct.cfg.id, line, sentId, `[${mime.split('/')[0]}: ${fname}]`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'sendTxRequest') {
      const { line, to, amountEth, note, chainId } = args as {
        line: string; to: string; amountEth: number; note?: string; chainId?: number };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      if (!to || typeof to !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('sendTxRequest requires a valid 0x `to` address');
      if (typeof amountEth !== 'number' || !(amountEth > 0)) throw new Error('sendTxRequest requires a positive `amountEth`');
      const weiHex = '0x' + BigInt(Math.round(amountEth * 1e18)).toString(16);
      const content: WalletSendCallsParams = {
        version: '1.0',
        chainId: toHex(chainId ?? 1),
        from: acct.address as `0x${string}`,
        calls: [{
          to: to as `0x${string}`,
          value: weiHex as `0x${string}`,
          metadata: { description: note ?? 'Payment request', transactionType: 'transfer' },
        }],
      };
      const sentId = await conv.send(new WalletSendCallsCodec().encode(content));
      emitOutbound(acct.cfg.id, line, sentId, `💸 ${note ?? 'Payment request'} (${amountEth} ETH)`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'sendSignatureRequest') {
      const { line, kind, eip712, message, description } = args as {
        line: string; kind?: 'eip712' | 'personal'; eip712?: unknown; message?: string; description?: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const k: 'eip712' | 'personal' = kind === 'eip712' ? 'eip712' : 'personal';
      if (k === 'eip712' && !eip712) throw new Error('sendSignatureRequest eip712 requires an `eip712` typed-data object');
      if (k === 'personal' && (!message || typeof message !== 'string')) throw new Error('sendSignatureRequest personal requires a `message` string');
      const content: SignatureRequestContent = {
        id: 'sig_' + Date.now().toString(36),
        kind: k,
        ...(k === 'eip712' ? { eip712 } : { message }),
        description,
      };
      const sentId = await conv.send(new SignatureRequestCodec().encode(content));
      emitOutbound(acct.cfg.id, line, sentId, `✍️ ${description ?? 'Signature request'}`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'newDm') {
      const { address } = args as { address: string };
      const acct = accountForCall(args as { account?: string });
      const dm = await acct.client.conversations.createDmWithIdentifier({
        identifier: address, identifierKind: IdentifierKind.Ethereum });
      respond(id, { result: { line: lineOf(acct.cfg.id, dm.id), id: dm.id, account: acct.cfg.id } });
    } else if (action === 'newGroup') {
      const { addresses, name, permissions } = args as {
        addresses: string[]; name?: string; permissions?: 'admin-only' | 'default' };
      const acct = accountForCall(args as { account?: string });
      const opts: { groupName?: string; permissions?: number } = {};
      if (name) opts.groupName = name;
      if (permissions === 'admin-only') opts.permissions = 1;
      const group = await acct.client.conversations.createGroupWithIdentifiers(
        addresses.map(a => ({ identifier: a, identifierKind: IdentifierKind.Ethereum })), opts);
      respond(id, { result: { line: lineOf(acct.cfg.id, group.id), id: group.id, account: acct.cfg.id } });
    } else if (action === 'register-push') {
      const { token, account, platform, inboxId } = args as {
        token?: string; account?: string; platform?: string; inboxId?: string };
      if (!token || typeof token !== 'string' || token.length < 20) throw new Error('register-push requires a non-empty FCM device token');
      const total = storePushToken({ token, account, platform, inboxId });
      respond(id, { result: { stored: true, total, account: account ?? null } });
    } else if (action === 'list-push') {
      const tokens = loadPushTokens();
      respond(id, { result: { count: tokens.length, tokens: tokens.map(t => ({
        token: `${t.token.slice(0, 12)}…${t.token.slice(-6)}`, registeredAt: t.registeredAt,
        lastSeenAt: t.lastSeenAt ?? null, account: t.account ?? null,
        platform: t.platform ?? null, inboxId: t.inboxId ?? null })) } });
    } else if (action === 'test-push') {
      const { title, body, account } = args as { title?: string; body?: string; account?: string };
      const acctId = account ?? (accounts.size === 1 ? [...accounts.keys()][0] : 'default');
      await fcmPushToAll(acctId, title ?? 'Metro test', body ?? 'Push pipeline is alive ✅', { source: 'test-push' });
      respond(id, { result: { sent: loadPushTokens().filter(t => !t.account || t.account === acctId).length, account: acctId } });
    } else if (action === 'unregister-push') {
      const { token } = args as { token: string };
      savePushTokens(loadPushTokens().filter(t => t.token !== token));
      respond(id, { result: { removed: true } });
    } else if (action === 'query') {
      const { line, limit } = args as { line: string; limit?: number };
      const { conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const lim = Math.min(Math.max(1, limit ?? 20), 200);
      await conv.sync().catch(() => undefined);
      const all = await conv.messages();
      const slice = all.slice(-lim);
      const acctId = parseLine(line)!.accountId;
      const messages = slice.map(m => {
        let text = '';
        try { const cc: unknown = m.content; text = typeof cc === 'string' ? cc : `[${m.contentType?.typeId ?? 'unknown'}]`; }
        catch { text = `[${m.contentType?.typeId ?? 'unknown'}]`; }
        return { id: m.id, ts: new Date(Number(m.sentAtNs / 1_000_000n)).toISOString(),
          from: `metro://xmtp/${acctId}/user/${m.senderInboxId}`, text, contentType: m.contentType?.typeId ?? 'unknown' };
      });
      respond(id, { result: { line, count: messages.length, messages } });
    } else if (action === 'groupInfo') {
      const { line } = args as { line: string };
      const { acct, conv } = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const members = await conv.members();
      const inboxIds = members.map(m => m.inboxId);
      const addresses: Record<string, string> = {};
      /** #9: serve cached inbox→eth first; only fetch states for the misses. */
      const missing = inboxIds.filter(iid => {
        const cached = inboxEthCache.get(iid);
        if (cached) { addresses[iid] = cached; return false; }
        return true;
      });
      if (missing.length) {
        try {
          const states = await acct.client.preferences.fetchInboxStates(missing);
          for (let i = 0; i < missing.length; i++) {
            const eth = states[i]?.identifiers.find((it: { identifierKind: IdentifierKind }) => it.identifierKind === IdentifierKind.Ethereum);
            if (eth?.identifier) { addresses[missing[i]!] = eth.identifier; inboxEthCache.set(missing[i]!, eth.identifier); }
          }
        } catch { /* best-effort */ }
      }
      const isDm = typeof (conv as unknown as { peerInboxId?: unknown }).peerInboxId === 'function';
      const groupName = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
      const resolvedName = typeof groupName === 'function' ? await groupName() : (groupName ?? '');
      respond(id, { result: { line, id: conv.id, account: acct.cfg.id, version: isDm ? 'dm' : 'group',
        name: resolvedName ?? '', memberCount: inboxIds.length,
        members: inboxIds.map(iid => ({ inboxId: iid, address: addresses[iid] ?? null })) } });
    } else if (action === 'listConvs') {
      /** Optional `account` arg → list one account; else list across all. */
      const { limit, account } = args as { limit?: number; account?: string };
      const lim = Math.min(Math.max(1, limit ?? 50), 200);
      const targets = account ? [accounts.get(account)!].filter(Boolean) : [...accounts.values()];
      const summaries: unknown[] = [];
      for (const acct of targets) {
        await acct.client.conversations.syncAll();
        const all = await acct.client.conversations.list();
        for (const c of all.slice(0, lim)) {
          /** #9: bounded — fetch only the newest message (descending=1) instead of the whole history. */
          const recent = await c.messages({ limit: 1, direction: 1 } as Parameters<typeof c.messages>[0]).catch(() => []);
          const last = recent[0];
          let preview = '';
          if (last) { const cc: unknown = last.content; preview = typeof cc === 'string' ? cc.slice(0, 80) : `[${last.contentType?.typeId ?? 'unknown'}]`; }
          const isDm = typeof (c as unknown as { peerInboxId?: unknown }).peerInboxId === 'function';
          const gn = (c as unknown as { name?: string | (() => Promise<string>) }).name;
          const resolvedName = typeof gn === 'function' ? await gn().catch(() => '') : (gn ?? '');
          summaries.push({ line: lineOf(acct.cfg.id, c.id), id: c.id, account: acct.cfg.id,
            version: isDm ? 'dm' : 'group', name: resolvedName ?? '',
            lastTs: last ? new Date(Number(last.sentAtNs / 1_000_000n)).toISOString() : null, lastPreview: preview });
        }
      }
      summaries.sort((a, b) => ((b as { lastTs?: string }).lastTs ?? '').localeCompare((a as { lastTs?: string }).lastTs ?? ''));
      respond(id, { result: { count: summaries.length, conversations: summaries.slice(0, lim) } });
    } else {
      respond(id, { error: `unknown action '${action}' (have: accounts, send, sendPoll, sendImage, sendTxRequest, react, reply, sendAttachment, newDm, newGroup, query, groupInfo, listConvs, register-push, list-push, test-push, unregister-push)` });
    }
  } catch (err) { respond(id, { error: (err as Error).message }); }
}

/* ──────────── stdin loop ──────────── */

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const msg = JSON.parse(line); if (msg.op === 'call') void handleCall(msg); }
    catch (err) { process.stderr.write(`bad stdin line: ${(err as Error).message}\n`); }
  }
});

/* ──────────── boot all accounts + per-account stream loops ──────────── */

const SYNC_MS = Number(process.env.XMTP_SYNC_MS ?? '15000');
const SILENT_TYPES = new Set(['readReceipt', 'transactionReference', 'walletSendCalls', 'groupUpdated', 'group_updated']);

/** Run one account's sync timer + message stream, isolated so a crash in one
 *  account doesn't down the whole train. */
async function runAccount(acct: Account): Promise<void> {
  const { id } = acct.cfg;
  try {
    await acct.client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
    const initial = await acct.client.conversations.list();
    process.stderr.write(`xmtp[${id}]: synced ${initial.length} conversation(s) at boot\n`);
  } catch (err) { process.stderr.write(`xmtp[${id}] boot sync error: ${(err as Error).message}\n`); }

  setInterval(async () => {
    try { await acct.client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]); }
    catch (err) { process.stderr.write(`xmtp[${id}] sync error: ${(err as Error).message}\n`); }
  }, SYNC_MS).unref();

  /** Message stream with reconnect: if the stream throws, log + retry after 5s
   *  rather than letting the rejection bubble and exit the process. */
  for (;;) {
    try {
      const stream = await acct.client.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed, ConsentState.Unknown] });
      for await (const msg of stream) {
        if (!msg) continue;
        if (msg.senderInboxId === acct.client.inboxId) continue;                 // own/echo
        if (SILENT_TYPES.has(msg.contentType?.typeId ?? '')) continue;           // silent types
        // F2 (daemon side): consume control DMs (METRO_CTRL:… plain text) —
        // never surface as chat, never push. register-push stores the token
        // scoped to THIS receiving account + the sender's authoritative inbox.
        if (handleControlDm(id, msg)) continue;
        const conv = await acct.client.conversations.getConversationById(msg.conversationId);
        if (!conv) continue;
        const env = envelope(id, msg, conv);
        emitInbound(id, env);
        // F1 + E1: fan out an FCM push to THIS account's registered device tokens
        // for the real inbound message. fcmPushToAll(id) scopes to that account.
        pushInbound(id, env, msg, conv);
      }
    } catch (err) {
      process.stderr.write(`xmtp[${id}] stream error (retry 5s): ${(err as Error).message}\n`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

/** Boot every account; tolerate individual boot failures. */
const cfgs = loadAccounts();
for (const cfg of cfgs) {
  try { await bootAccount(cfg); }
  catch (err) { process.stderr.write(`xmtp[${cfg.id}] boot FAILED: ${(err as Error).message}\n`); }
}
if (accounts.size === 0) { process.stderr.write('xmtp: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(`xmtp train ready — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);

for (const acct of accounts.values()) void runAccount(acct);
