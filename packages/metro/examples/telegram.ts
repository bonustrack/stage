/**
 * Telegram train — MULTI-BOT (DRAFT, mirrors the live multi-account xmtp train).
 *
 * Difference from the single-bot train (~/.metro/trains/telegram.ts):
 *   - Boots N bots from ~/.metro/telegram-accounts.json (one long-poll loop per token).
 *   - Lines are account-scoped: metro://telegram/<accountId>/<chatId>[/<topicId>].
 *     Legacy metro://telegram/<chatId>[/<topicId>] still parses (→ `default`/first acct).
 *   - Every inbound event carries payload.account = <accountId> and, if the account
 *     declares an `owner`, sets `to` = owner so a session tailing `--as <owner>
 *     --strict` receives only that bot's feed (feed isolation) — like xmtp.ts.
 *   - Outbound actions take an optional `account` (else inferred from the line).
 *   - Keeps ALL existing actions: send, react, edit, delete, send_photo,
 *     send_document, send_voice, send_sticker, send_dice, send_location, download
 *     (+ new: accounts).
 *
 * Back-compat: if telegram-accounts.json is absent, synthesizes a single `default`
 * account from $TELEGRAM_BOT_TOKEN — behaves like the old train (legacy lines).
 *
 * MULTI-BOT POLLING NOTE (the one real gotcha): Telegram getUpdates is scoped to a
 * single bot token, and DIFFERENT bots have DIFFERENT tokens, so N independent
 * long-poll loops do NOT conflict — each only sees its own bot's updates. The only
 * conflict ("terminated by other getUpdates request", 409) happens when TWO clients
 * poll the SAME token, or when a webhook is set on a token you also try to poll. We
 * therefore (a) reject duplicate tokens at config load, and (b) clear any stale
 * webhook per token at boot (deleteWebhook with drop_pending_updates=false). No
 * single shared poll loop is possible across bots; one loop per token is required
 * and is correct. See TELEGRAM-MULTIBOT-DESIGN.md §Blocker.
 *
 * Activation: write ~/.metro/telegram-accounts.json, swap this file in for
 * telegram.ts, ONE `metro trains restart telegram`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* ──────────── account config ──────────── */

const ACCOUNTS_FILE = process.env.TELEGRAM_ACCOUNTS_FILE
  ?? join(homedir(), '.metro', 'telegram-accounts.json');

interface AccountConfig {
  id: string;
  /** Telegram bot token for this identity. */
  token: string;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
}

/** Legacy metro://telegram/<chatId> lines for the default account (migration). */
let LEGACY_DEFAULT_LINES = process.env.TELEGRAM_LEGACY_DEFAULT_LINES === '1';

const ACCOUNT_ALLOWLIST = new Set(
  (process.env.TELEGRAM_ONLY_ACCOUNTS ?? process.env.TELEGRAM_ACCOUNTS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
);

function loadAccounts(): AccountConfig[] {
  if (existsSync(ACCOUNTS_FILE)) {
    let raw: AccountConfig[];
    try { raw = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as AccountConfig[]; }
    catch (e) { process.stderr.write(`telegram: bad ${ACCOUNTS_FILE}: ${(e as Error).message}\n`); process.exit(2); }
    if (!Array.isArray(raw) || raw.length === 0) {
      process.stderr.write(`telegram: ${ACCOUNTS_FILE} must be a non-empty array\n`); process.exit(2);
    }
    const seenId = new Set<string>();
    const seenTok = new Set<string>();
    for (const a of raw) {
      if (!a.id) { process.stderr.write('telegram: account missing id\n'); process.exit(2); }
      if (!a.token || typeof a.token !== 'string') {
        process.stderr.write(`telegram: account '${a.id}' missing token\n`); process.exit(2);
      }
      if (seenId.has(a.id)) { process.stderr.write(`telegram: duplicate account id '${a.id}'\n`); process.exit(2); }
      // Two loops polling the SAME token => 409 Conflict. Reject early.
      if (seenTok.has(a.token)) { process.stderr.write(`telegram: account '${a.id}' reuses a token already used by another account (would 409 on getUpdates)\n`); process.exit(2); }
      seenId.add(a.id); seenTok.add(a.token);
    }
    const selected = ACCOUNT_ALLOWLIST.size ? raw.filter(a => ACCOUNT_ALLOWLIST.has(a.id)) : raw;
    if (selected.length === 0) {
      process.stderr.write(`telegram: no accounts match TELEGRAM_ONLY_ACCOUNTS (${[...ACCOUNT_ALLOWLIST].join(', ')})\n`);
      process.exit(2);
    }
    return selected;
  }
  /** Back-compat: single account from env, legacy lines so existing claims keep working. */
  const tok = process.env.TELEGRAM_BOT_TOKEN;
  if (!tok) { process.stderr.write(`telegram: no ${ACCOUNTS_FILE} and TELEGRAM_BOT_TOKEN unset\n`); process.exit(2); }
  LEGACY_DEFAULT_LINES = true;
  return [{ id: 'default', token: tok }];
}

/* ──────────── wire helpers ──────────── */

const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');
const respond = (id: string, body: { result?: unknown; error?: string }): void =>
  void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;
const SELF_URI = process.env.METRO_SELF_URI ?? '';

/* ──────────── per-account client boot ──────────── */

interface Account {
  cfg: AccountConfig;
  api: string;
  fileApi: string;
  offset: number;
}
const accounts = new Map<string, Account>();

async function tg<T>(accountId: string, method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
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

async function tgForm<T>(accountId: string, method: string, form: FormData, timeoutMs = 60_000): Promise<T> {
  const acct = accounts.get(accountId);
  if (!acct) throw new Error(`unknown account '${accountId}'`);
  const res = await fetch(`${acct.api}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown'}`);
  return json.result as T;
}

/* ──────────── line helpers (account-scoped) ──────────── */

type TgMsg = {
  message_id: number; date: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  text?: string; caption?: string;
  message_thread_id?: number; is_topic_message?: boolean;
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: { file_name?: string; file_id?: string };
  voice?: { file_id?: string; duration?: number };
  audio?: { file_id?: string; file_name?: string };
  video?: { file_id?: string; file_name?: string };
  animation?: { file_id?: string; file_name?: string };
  sticker?: { file_id?: string; emoji?: string; set_name?: string };
  location?: { latitude: number; longitude: number };
  dice?: { emoji: string; value: number };
};

/** Account-scoped line. The default account may emit legacy lines for migration. */
function lineOf(accountId: string, chatId: number | string, topicId?: number): string {
  const tail = topicId !== undefined ? `${chatId}/${topicId}` : `${chatId}`;
  if (accountId === 'default' && LEGACY_DEFAULT_LINES) return `metro://telegram/${tail}`;
  return `metro://telegram/${accountId}/${tail}`;
}

function lineForMsg(accountId: string, m: TgMsg): { line: string; topicId?: number } {
  const topicId = m.is_topic_message ? m.message_thread_id : undefined;
  return { line: lineOf(accountId, m.chat.id, topicId), topicId };
}

/** Parse a line back to {accountId, chatId, topicId}. Accepts new + legacy forms.
 *  chatId is a signed integer; accountId is non-numeric by convention, which
 *  disambiguates a legacy line from a new one. */
function targetOf(line: string, accountOverride?: string): { accountId: string; chatId: number; topicId?: number } {
  // new: metro://telegram/<acct>/<chatId>[/<topicId>]  (acct is non-(-?digit))
  const mNew = line.match(/^metro:\/\/telegram\/([^/]+)\/(-?\d+)(?:\/(\d+))?$/);
  if (mNew && !/^-?\d+$/.test(mNew[1])) {
    return { accountId: accountOverride ?? mNew[1], chatId: Number(mNew[2]), topicId: mNew[3] ? Number(mNew[3]) : undefined };
  }
  // legacy: metro://telegram/<chatId>[/<topicId>]
  const mLegacy = line.match(/^metro:\/\/telegram\/(-?\d+)(?:\/(\d+))?$/);
  if (mLegacy) {
    return { accountId: accountOverride ?? 'default', chatId: Number(mLegacy[1]), topicId: mLegacy[2] ? Number(mLegacy[2]) : undefined };
  }
  throw new Error(`bad telegram line: ${line}`);
}

function projectText(m: TgMsg): string {
  const tags: string[] = [];
  if (m.photo?.length) tags.push('[image]');
  if (m.voice) tags.push('[voice]');
  if (m.audio) tags.push(`[audio: ${m.audio.file_name ?? 'audio'}]`);
  if (m.video) tags.push(`[video: ${m.video.file_name ?? 'video'}]`);
  if (m.animation) tags.push(`[gif: ${m.animation.file_name ?? 'gif'}]`);
  if (m.sticker) tags.push(`[sticker${m.sticker.emoji ? ` ${m.sticker.emoji}` : ''}${m.sticker.set_name ? ` · ${m.sticker.set_name}` : ''}]`);
  if (m.document && !m.animation) tags.push(`[file: ${m.document.file_name ?? 'doc'}]`);
  if (m.location) tags.push(`[location: ${m.location.latitude}, ${m.location.longitude}]`);
  if (m.dice) tags.push(`[dice ${m.dice.emoji} = ${m.dice.value}]`);
  return [m.text ?? m.caption, ...tags].filter(Boolean).join(' ');
}

function envelope(accountId: string, m: TgMsg): Record<string, unknown> {
  const { line } = lineForMsg(accountId, m);
  return {
    kind: 'inbound', id: mintId(), ts: new Date(m.date * 1000).toISOString(),
    station: 'telegram', line,
    line_name: m.chat.title ?? m.chat.first_name ?? undefined,
    from: `metro://telegram/${accountId}/user/${m.from?.id ?? 'unknown'}`,
    from_name: m.from?.username ? `@${m.from.username}` : m.from?.first_name,
    message_id: String(m.message_id), text: projectText(m), payload: m, is_private: m.chat.type === 'private',
  };
}

type TgReaction = {
  chat: { id: number; type: string };
  message_id: number;
  user?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  date: number;
  old_reaction: Array<{ type: string; emoji?: string }>;
  new_reaction: Array<{ type: string; emoji?: string }>;
};

function reactionEnvelope(accountId: string, r: TgReaction): Record<string, unknown> | null {
  if (r.user?.is_bot) return null;
  const newEmojis = r.new_reaction.filter(x => x.type === 'emoji').map(x => x.emoji ?? '');
  const oldEmojis = r.old_reaction.filter(x => x.type === 'emoji').map(x => x.emoji ?? '');
  const added = newEmojis.filter(e => !oldEmojis.includes(e));
  if (!added.length) return null;
  return {
    kind: 'react', id: mintId(), ts: new Date(r.date * 1000).toISOString(),
    station: 'telegram', line: lineOf(accountId, r.chat.id),
    from: `metro://telegram/${accountId}/user/${r.user?.id ?? 'unknown'}`,
    from_name: r.user?.username ? `@${r.user.username}` : r.user?.first_name,
    message_id: String(r.message_id), emoji: added[0],
    is_private: r.chat.type === 'private', payload: r,
  };
}

/* ──────────── inbound emission (account-tagged + owner-routed) ──────────── */

function emitInbound(accountId: string, e: Record<string, unknown>): void {
  const owner = accounts.get(accountId)?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}

function emitOutbound(accountId: string, line: string, messageId: string, text: string, replyTo?: string): void {
  emit({
    kind: 'outbound', id: mintId(), ts: new Date().toISOString(),
    station: 'telegram', line, from: SELF_URI, to: line, message_id: messageId, text, reply_to: replyTo,
    account: accountId, payload: { account: accountId },
  });
}

/* ──────────── routing ──────────── */

function accountFor(args: { account?: string; line?: string }): string {
  let id = args.account;
  if (!id && args.line) { try { id = targetOf(args.line).accountId; } catch { /* ignore */ } }
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  if (!accounts.has(id)) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return id;
}

async function sendMedia(method: string, fieldName: string, args: Record<string, unknown>): Promise<{ accountId: string; message_id: number }> {
  const { line, path, caption, replyTo, parseMode, account } = args as { line: string; path: string; caption?: string; replyTo?: string; parseMode?: string; account?: string };
  const { accountId, chatId, topicId } = targetOf(line, account);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (topicId !== undefined) form.append('message_thread_id', String(topicId));
  if (caption) form.append('caption', caption);
  if (parseMode) form.append('parse_mode', parseMode);
  if (replyTo) form.append('reply_parameters', JSON.stringify({ message_id: Number(replyTo) }));
  const data = await Bun.file(path).arrayBuffer();
  const name = path.split('/').pop() ?? fieldName;
  form.append(fieldName, new Blob([data]), name);
  const r = await tgForm<{ message_id: number }>(accountId, method, form);
  return { accountId, message_id: r.message_id };
}

/* ──────────── outbound action handler ──────────── */

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

async function handleCall({ id, action, args }: CallMsg): Promise<void> {
  try {
    if (action === 'accounts') {
      respond(id, { result: { accounts: [...accounts.values()].map(a => ({
        id: a.cfg.id, owner: a.cfg.owner ?? null })) } });
    } else if (action === 'send') {
      const { line, text, replyTo, parseMode, buttons, account } = args as { line: string; text: string; replyTo?: string; parseMode?: string; buttons?: Array<Array<{ text: string; url: string }>>; account?: string };
      const { accountId, chatId, topicId } = targetOf(line, account);
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (topicId !== undefined) body.message_thread_id = topicId;
      if (replyTo) body.reply_parameters = { message_id: Number(replyTo) };
      if (parseMode) body.parse_mode = parseMode;
      if (buttons) body.reply_markup = { inline_keyboard: buttons };
      const sent = await tg<{ message_id: number }>(accountId, 'sendMessage', body);
      emitOutbound(accountId, line, String(sent.message_id), text, replyTo);
      respond(id, { result: { messageId: String(sent.message_id), account: accountId } });
    } else if (action === 'react') {
      const { line, messageId, emoji, account } = args as { line: string; messageId: string; emoji: string; account?: string };
      const { accountId, chatId } = targetOf(line, account);
      await tg(accountId, 'setMessageReaction', {
        chat_id: chatId, message_id: Number(messageId),
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
      });
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'edit') {
      const { line, messageId, text, parseMode, account } = args as { line: string; messageId: string; text: string; parseMode?: string; account?: string };
      const { accountId, chatId } = targetOf(line, account);
      await tg(accountId, 'editMessageText', { chat_id: chatId, message_id: Number(messageId), text, parse_mode: parseMode });
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'delete') {
      const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
      const { accountId, chatId } = targetOf(line, account);
      await tg(accountId, 'deleteMessage', { chat_id: chatId, message_id: Number(messageId) });
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'send_photo') {
      const { accountId, message_id } = await sendMedia('sendPhoto', 'photo', args);
      const line = (args as { line: string }).line;
      emitOutbound(accountId, line, String(message_id), (args.caption as string ?? '') + ' [image]', args.replyTo as string | undefined);
      respond(id, { result: { messageId: String(message_id), account: accountId } });
    } else if (action === 'send_document') {
      const { accountId, message_id } = await sendMedia('sendDocument', 'document', args);
      const line = (args as { line: string }).line;
      emitOutbound(accountId, line, String(message_id), (args.caption as string ?? '') + ' [file]', args.replyTo as string | undefined);
      respond(id, { result: { messageId: String(message_id), account: accountId } });
    } else if (action === 'send_voice') {
      const { accountId, message_id } = await sendMedia('sendVoice', 'voice', args);
      const line = (args as { line: string }).line;
      emitOutbound(accountId, line, String(message_id), '[voice]', args.replyTo as string | undefined);
      respond(id, { result: { messageId: String(message_id), account: accountId } });
    } else if (action === 'send_sticker') {
      const { accountId, message_id } = await sendMedia('sendSticker', 'sticker', args);
      const line = (args as { line: string }).line;
      emitOutbound(accountId, line, String(message_id), '[sticker]', args.replyTo as string | undefined);
      respond(id, { result: { messageId: String(message_id), account: accountId } });
    } else if (action === 'send_dice') {
      const { line, emoji = '🎲', account } = args as { line: string; emoji?: string; account?: string };
      const { accountId, chatId, topicId } = targetOf(line, account);
      const body: Record<string, unknown> = { chat_id: chatId, emoji };
      if (topicId !== undefined) body.message_thread_id = topicId;
      const r = await tg<{ message_id: number; dice?: { value: number } }>(accountId, 'sendDice', body);
      emitOutbound(accountId, line, String(r.message_id), `[dice ${emoji} = ${r.dice?.value ?? '?'}]`);
      respond(id, { result: { messageId: String(r.message_id), value: r.dice?.value, account: accountId } });
    } else if (action === 'send_location') {
      const { line, latitude, longitude, account } = args as { line: string; latitude: number; longitude: number; account?: string };
      const { accountId, chatId } = targetOf(line, account);
      const r = await tg<{ message_id: number }>(accountId, 'sendLocation', { chat_id: chatId, latitude, longitude });
      emitOutbound(accountId, line, String(r.message_id), `[location: ${latitude}, ${longitude}]`);
      respond(id, { result: { messageId: String(r.message_id), account: accountId } });
    } else if (action === 'download') {
      // `account` selects which bot's file API (file_ids are per-bot); else sole/default.
      const { fileId, outDir = '/tmp', account } = args as { fileId: string; outDir?: string; account?: string };
      const accountId = accountFor({ account });
      const meta = await tg<{ file_path: string }>(accountId, 'getFile', { file_id: fileId });
      const data = await fetch(`${accounts.get(accountId)!.fileApi}/${meta.file_path}`).then(r => r.arrayBuffer());
      const filename = meta.file_path.split('/').pop() ?? `${fileId}.bin`;
      const path = `${outDir}/${Date.now()}-${filename}`;
      await Bun.write(path, data);
      respond(id, { result: { path, fileSize: data.byteLength, account: accountId } });
    } else {
      respond(id, { error: `unknown action '${action}' (have: accounts, send, react, edit, delete, send_photo, send_document, send_voice, send_sticker, send_dice, send_location, download)` });
    }
  } catch (err) { respond(id, { error: (err as Error).message }); }
}

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

/* ──────────── per-account long-poll loop ──────────── */

type Update = { update_id: number; message?: TgMsg; message_reaction?: TgReaction };

/** One account's poll loop, isolated so a crash in one bot doesn't down the train. */
async function runAccount(acct: Account): Promise<void> {
  const { id } = acct.cfg;
  // Clear any stale webhook so getUpdates won't 409 ("can't use getUpdates while
  // webhook is active"). Each bot has its own token → its own webhook state.
  try { await tg(id, 'deleteWebhook', { drop_pending_updates: false }); }
  catch (err) { process.stderr.write(`telegram[${id}] deleteWebhook: ${(err as Error).message}\n`); }

  for (;;) {
    try {
      const updates = await tg<Update[]>(id, 'getUpdates',
        { offset: acct.offset, timeout: 25, allowed_updates: ['message', 'message_reaction'] }, 60_000);
      for (const u of updates) {
        acct.offset = u.update_id + 1;
        if (u.message && !u.message.from?.is_bot) emitInbound(id, envelope(id, u.message));
        if (u.message_reaction) {
          const env = reactionEnvelope(id, u.message_reaction);
          if (env) emitInbound(id, env);
        }
      }
    } catch (err) {
      process.stderr.write(`telegram[${id}] poll error: ${(err as Error).message}\n`);
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
}

/* ──────────── boot all accounts ──────────── */

const cfgs = loadAccounts();
for (const cfg of cfgs) {
  accounts.set(cfg.id, {
    cfg,
    api: `https://api.telegram.org/bot${cfg.token}`,
    fileApi: `https://api.telegram.org/file/bot${cfg.token}`,
    offset: 0,
  });
}
if (accounts.size === 0) { process.stderr.write('telegram: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(`telegram train ready (multi) — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);

for (const acct of accounts.values()) void runAccount(acct);
