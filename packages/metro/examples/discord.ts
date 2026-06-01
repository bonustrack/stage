/**
 * Discord train — MULTI-BOT (DRAFT, mirrors the live multi-account xmtp train).
 *
 * Difference from the single-bot train (~/.metro/trains/discord.ts):
 *   - Boots N discord.js Clients from ~/.metro/discord-accounts.json (one gateway
 *     connection per bot token).
 *   - Lines are account-scoped: metro://discord/<accountId>/<channelId>.
 *     Legacy metro://discord/<channelId> still parses (→ the `default`/first account).
 *   - Every inbound event carries payload.account = <accountId> and, if the account
 *     declares an `owner`, sets `to` = owner so a session tailing `--as <owner>
 *     --strict` receives only that bot's feed (feed isolation, no core change) —
 *     exactly like xmtp.ts emitInbound().
 *   - Outbound actions take an optional `account` (else inferred from the line).
 *   - Keeps ALL existing actions: send, reply, react, edit, delete, fetch,
 *     download, thread_create, pin, typing, channel, set_presence (+ new: accounts).
 *
 * Back-compat: if discord-accounts.json is absent, synthesizes a single `default`
 * account from $DISCORD_BOT_TOKEN — behaves like the old train (legacy lines).
 *
 * Activation: write ~/.metro/discord-accounts.json (see DISCORD-MULTIBOT-DESIGN.md
 * runbook), swap this file in for discord.ts, ONE `metro trains restart discord`.
 */

import {
  ActivityType, Client, Events, GatewayIntentBits, Partials,
  type Message, type MessageReaction, type PresenceStatusData, type User,
} from 'discord.js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = 'https://discord.com/api/v10';

/* ──────────── account config ──────────── */

const ACCOUNTS_FILE = process.env.DISCORD_ACCOUNTS_FILE
  ?? join(homedir(), '.metro', 'discord-accounts.json');

interface AccountConfig {
  id: string;
  /** Discord bot token for this identity. */
  token: string;
  /** Default `to` for this account's inbound events → feed isolation. */
  owner?: string;
}

/** If the default account should keep emitting legacy metro://discord/<channelId>
 *  lines (zero migration for existing claims/deep-links), set
 *  DISCORD_LEGACY_DEFAULT_LINES=1. Auto-on when running single-token back-compat. */
let LEGACY_DEFAULT_LINES = process.env.DISCORD_LEGACY_DEFAULT_LINES === '1';

const ACCOUNT_ALLOWLIST = new Set(
  (process.env.DISCORD_ONLY_ACCOUNTS ?? process.env.DISCORD_ACCOUNTS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
);

function loadAccounts(): AccountConfig[] {
  if (existsSync(ACCOUNTS_FILE)) {
    let raw: AccountConfig[];
    try { raw = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as AccountConfig[]; }
    catch (e) { process.stderr.write(`discord: bad ${ACCOUNTS_FILE}: ${(e as Error).message}\n`); process.exit(2); }
    if (!Array.isArray(raw) || raw.length === 0) {
      process.stderr.write(`discord: ${ACCOUNTS_FILE} must be a non-empty array\n`); process.exit(2);
    }
    const seen = new Set<string>();
    for (const a of raw) {
      if (!a.id) { process.stderr.write('discord: account missing id\n'); process.exit(2); }
      if (!a.token || typeof a.token !== 'string') {
        process.stderr.write(`discord: account '${a.id}' missing token\n`); process.exit(2);
      }
      if (seen.has(a.id)) { process.stderr.write(`discord: duplicate account id '${a.id}'\n`); process.exit(2); }
      seen.add(a.id);
    }
    const selected = ACCOUNT_ALLOWLIST.size ? raw.filter(a => ACCOUNT_ALLOWLIST.has(a.id)) : raw;
    if (selected.length === 0) {
      process.stderr.write(`discord: no accounts match DISCORD_ONLY_ACCOUNTS (${[...ACCOUNT_ALLOWLIST].join(', ')})\n`);
      process.exit(2);
    }
    return selected;
  }
  /** Back-compat: single account from env, legacy lines so existing claims keep working. */
  const tok = process.env.DISCORD_BOT_TOKEN;
  if (!tok) { process.stderr.write(`discord: no ${ACCOUNTS_FILE} and DISCORD_BOT_TOKEN unset\n`); process.exit(2); }
  LEGACY_DEFAULT_LINES = true;
  return [{ id: 'default', token: tok }];
}

/* ──────────── wire helpers ──────────── */

const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');
const respond = (id: string, body: { result?: unknown; error?: string }): void =>
  void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;

/** Self URI for outbound emissions — the agent running metro. */
const SELF_URI = process.env.METRO_SELF_URI ?? 'metro://claude/user/8a1857f3-4039-4da6-a4e1-611b432d2082';

/** Per-account line. The default account may emit legacy lines for migration. */
function lineOf(accountId: string, channelId: string): string {
  if (accountId === 'default' && LEGACY_DEFAULT_LINES) return `metro://discord/${channelId}`;
  return `metro://discord/${accountId}/${channelId}`;
}

/** Parse a line back to {accountId, channelId}. Accepts new + legacy forms.
 *  channelId is a Discord snowflake (all-digit); accountId is non-numeric by
 *  convention, which disambiguates a legacy 1-segment line from a new 2-segment one. */
function parseLine(line: string): { accountId: string; channelId: string } | null {
  const mNew = line.match(/^metro:\/\/discord\/([^/]+)\/(\d+)$/);
  if (mNew) return { accountId: mNew[1], channelId: mNew[2] };
  const mLegacy = line.match(/^metro:\/\/discord\/(\d+)$/);
  if (mLegacy) return { accountId: 'default', channelId: mLegacy[1] };
  return null;
}

/* ──────────── per-account client boot ──────────── */

interface Account {
  cfg: AccountConfig;
  client: Client;
}
const accounts = new Map<string, Account>();

async function rest<T = unknown>(accountId: string, method: string, path: string, body?: unknown, isForm = false): Promise<T> {
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

/* ──────────── inbound emission (account-tagged + owner-routed) ──────────── */

/** Wrap emit: stamp account into payload and route `to` to the account owner. */
function emitInbound(accountId: string, e: Record<string, unknown>): void {
  const owner = accounts.get(accountId)?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}

function tagFor(att: { contentType?: string | null; name?: string | null; url?: string }): string {
  if (att.contentType?.startsWith('image/')) return '[image]';
  if (att.contentType?.startsWith('audio/')) return `[audio: ${att.name ?? 'audio'}]`;
  if (att.contentType?.startsWith('video/')) return `[video: ${att.name ?? 'video'}]`;
  return `[file: ${att.name ?? 'file'}]`;
}

function messageEnvelope(accountId: string, m: Message): Record<string, unknown> | null {
  if (m.author.bot) return null;
  const tags = m.attachments.map(a => tagFor({ contentType: a.contentType, name: a.name, url: a.url }));
  const stickerTags = m.stickers.map(s => `[sticker: ${s.name}]`);
  const text = [m.content.trim(), ...tags, ...stickerTags].filter(Boolean).join(' ');
  return {
    kind: 'inbound',
    id: mintId(),
    ts: new Date(m.createdTimestamp).toISOString(),
    station: 'discord',
    line: lineOf(accountId, m.channelId),
    line_name: 'name' in m.channel ? m.channel.name : undefined,
    from: `metro://discord/${accountId}/user/${m.author.id}`,
    from_name: m.author.username,
    message_id: m.id,
    text,
    is_private: m.guildId == null,
    reply_to: m.reference?.messageId ?? undefined,
    payload: m.toJSON(),
  };
}

function reactionEnvelope(accountId: string, r: MessageReaction, u: User): Record<string, unknown> | null {
  if (u.bot) return null;
  return {
    kind: 'react',
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'discord',
    line: lineOf(accountId, r.message.channelId),
    from: `metro://discord/${accountId}/user/${u.id}`,
    from_name: u.username,
    message_id: r.message.id,
    emoji: r.emoji.name ?? r.emoji.id ?? '?',
    is_private: r.message.guildId == null,
    payload: { channel_id: r.message.channelId, guild_id: r.message.guildId, emoji: r.emoji.toJSON(), user_id: u.id },
  };
}

function emitOutbound(accountId: string, line: string, messageId: string, text: string, replyTo?: string): void {
  emit({
    kind: 'outbound', id: mintId(), ts: new Date().toISOString(),
    station: 'discord', line, from: SELF_URI, to: line, message_id: messageId, text, reply_to: replyTo,
    account: accountId, payload: { account: accountId },
  });
}
function emitOutboundReact(accountId: string, line: string, messageId: string, emoji: string): void {
  emit({
    kind: 'react', id: mintId(), ts: new Date().toISOString(),
    station: 'discord', line, from: SELF_URI, to: line, message_id: messageId, emoji,
    account: accountId, payload: { account: accountId },
  });
}
function emitOutboundEdit(accountId: string, line: string, messageId: string, text: string): void {
  emit({
    kind: 'edit', id: mintId(), ts: new Date().toISOString(),
    station: 'discord', line, from: SELF_URI, to: line, message_id: messageId, text,
    account: accountId, payload: { account: accountId },
  });
}

/* ──────────── routing: line/account → account + channel ──────────── */

/** Resolve which account to use for an outbound call: explicit arg → from line → sole/default. */
function accountFor(args: { account?: string; line?: string }): string {
  let id = args.account;
  if (!id && args.line) id = parseLine(args.line)?.accountId;
  if (!id) id = accounts.size === 1 ? [...accounts.keys()][0] : 'default';
  if (!accounts.has(id)) throw new Error(`unknown account '${id}' (have: ${[...accounts.keys()].join(', ')})`);
  return id;
}

/** Parse {accountId, channelId} from a line, asserting the account is booted. */
function routeOf(line: string, account?: string): { accountId: string; channelId: string } {
  const parsed = parseLine(line);
  if (!parsed) throw new Error(`bad discord line: ${line}`);
  const accountId = account ?? parsed.accountId;
  if (!accounts.has(accountId)) throw new Error(`unknown account '${accountId}' in line ${line}`);
  return { accountId, channelId: parsed.channelId };
}

const encodeEmoji = (e: string): string => encodeURIComponent(e);

/* ──────────── outbound action handler ──────────── */

async function sendMessage(accountId: string, channel: string, body: Record<string, unknown>, files?: string[]): Promise<{ id: string }> {
  if (!files || files.length === 0) {
    return rest<{ id: string }>(accountId, 'POST', `/channels/${channel}/messages`, body);
  }
  const form = new FormData();
  form.append('payload_json', JSON.stringify(body));
  for (let i = 0; i < files.length; i++) {
    const path = files[i];
    const data = await Bun.file(path).arrayBuffer();
    const name = path.split('/').pop() ?? `file-${i}`;
    form.append(`files[${i}]`, new Blob([data]), name);
  }
  return rest<{ id: string }>(accountId, 'POST', `/channels/${channel}/messages`, form, true);
}

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

async function handleCall({ id, action, args }: CallMsg): Promise<void> {
  try {
    if (action === 'accounts') {
      respond(id, { result: { accounts: [...accounts.values()].map(a => ({
        id: a.cfg.id,
        userId: a.client.user?.id ?? null,
        username: a.client.user?.username ?? null,
        owner: a.cfg.owner ?? null,
        ready: a.client.isReady(),
      })) } });
    } else if (action === 'send') {
      // sticker_ids: send default Discord or custom-guild stickers.
      // images / files: local paths uploaded as multipart attachments (Discord 25MB total).
      // flags=4 SUPPRESS_EMBEDS — no auto link preview on URLs.
      const { line, text, replyTo, embeds, stickerIds, images, files, account } = args as {
        line: string; text?: string; replyTo?: string; embeds?: unknown[]; stickerIds?: string[]; images?: string[]; files?: string[]; account?: string;
      };
      const { accountId, channelId } = routeOf(line, account);
      const body: Record<string, unknown> = { flags: 4 };
      if (text !== undefined) body.content = text;
      if (replyTo) body.message_reference = { message_id: replyTo };
      if (embeds) body.embeds = embeds;
      if (stickerIds) body.sticker_ids = stickerIds;
      const attachments = [...(images ?? []), ...(files ?? [])];
      const res = await sendMessage(accountId, channelId, body, attachments.length ? attachments : undefined);
      emitOutbound(accountId, line, res.id, text ?? '', replyTo);
      respond(id, { result: { messageId: res.id, account: accountId } });
    } else if (action === 'reply') {
      const { line, messageId, text, images, files, account } = args as { line: string; messageId: string; text: string; images?: string[]; files?: string[]; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      const body = { content: text, message_reference: { message_id: messageId }, flags: 4 };
      const attachments = [...(images ?? []), ...(files ?? [])];
      const res = await sendMessage(accountId, channelId, body, attachments.length ? attachments : undefined);
      emitOutbound(accountId, line, res.id, text, messageId);
      respond(id, { result: { messageId: res.id, account: accountId } });
    } else if (action === 'react') {
      const { line, messageId, emoji, account } = args as { line: string; messageId: string; emoji: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      if (emoji) {
        await rest(accountId, 'PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodeEmoji(emoji)}/@me`);
        emitOutboundReact(accountId, line, messageId, emoji);
      } else {
        await rest(accountId, 'DELETE', `/channels/${channelId}/messages/${messageId}/reactions/@me`);
      }
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'edit') {
      const { line, messageId, text, account } = args as { line: string; messageId: string; text: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      await rest(accountId, 'PATCH', `/channels/${channelId}/messages/${messageId}`, { content: text });
      emitOutboundEdit(accountId, line, messageId, text);
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'delete') {
      const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      await rest(accountId, 'DELETE', `/channels/${channelId}/messages/${messageId}`);
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'fetch') {
      const { line, limit = 20, before, account } = args as { line: string; limit?: number; before?: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      const qs = new URLSearchParams({ limit: String(limit), ...(before ? { before } : {}) });
      const msgs = await rest<Array<Message>>(accountId, 'GET', `/channels/${channelId}/messages?${qs}`);
      respond(id, { result: { messages: msgs, account: accountId } });
    } else if (action === 'download') {
      const { line, messageId, outDir = '/tmp', account } = args as { line: string; messageId: string; outDir?: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      const msg = await rest<{ attachments: Array<{ url: string; content_type?: string; filename: string }> }>(accountId, 'GET', `/channels/${channelId}/messages/${messageId}`);
      const files: Array<{ path: string; mediaType: string }> = [];
      for (const att of msg.attachments) {
        const buf = await fetch(att.url).then(r => r.arrayBuffer());
        const path = `${outDir}/${messageId}-${att.filename}`;
        await Bun.write(path, buf);
        files.push({ path, mediaType: att.content_type ?? 'application/octet-stream' });
      }
      respond(id, { result: { files, account: accountId } });
    } else if (action === 'thread_create') {
      const { line, messageId, name, autoArchiveDuration = 1440, account } = args as { line: string; messageId?: string; name: string; autoArchiveDuration?: number; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      const path = messageId
        ? `/channels/${channelId}/messages/${messageId}/threads`
        : `/channels/${channelId}/threads`;
      const res = await rest<{ id: string }>(accountId, 'POST', path, { name, auto_archive_duration: autoArchiveDuration });
      respond(id, { result: { threadId: res.id, line: lineOf(accountId, res.id), account: accountId } });
    } else if (action === 'pin') {
      const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      await rest(accountId, 'PUT', `/channels/${channelId}/pins/${messageId}`);
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'typing') {
      const { line, account } = args as { line: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      await rest(accountId, 'POST', `/channels/${channelId}/typing`);
      respond(id, { result: { ok: true, account: accountId } });
    } else if (action === 'channel') {
      const { line, account } = args as { line: string; account?: string };
      const { accountId, channelId } = routeOf(line, account);
      const res = await rest(accountId, 'GET', `/channels/${channelId}`);
      respond(id, { result: res });
    } else if (action === 'set_presence') {
      // text: custom-status string; status: online|idle|dnd|invisible (default 'online').
      // Empty text clears the activity entirely. Optional `account` (else applies to
      // the sole/default account); set per-bot presence by passing `account`.
      const { text, status = 'online', account } = args as { text?: string; status?: PresenceStatusData; account?: string };
      const accountId = accountFor({ account });
      const client = accounts.get(accountId)!.client;
      if (!client.user) { respond(id, { error: `gateway not ready for account '${accountId}'` }); return; }
      // For a custom status Discord requires the literal name "Custom Status" and
      // carries the visible text in `state`. Passing the text as `name` renders a
      // stray "·" separator in clients — so keep name fixed and only set state.
      client.user.setPresence({
        status,
        activities: text ? [{ name: 'Custom Status', type: ActivityType.Custom, state: text }] : [],
      });
      respond(id, { result: { ok: true, text: text ?? null, status, account: accountId } });
    } else {
      respond(id, { error: `unknown action '${action}' (have: accounts, send, reply, react, edit, delete, fetch, download, thread_create, pin, typing, channel, set_presence)` });
    }
  } catch (err) {
    respond(id, { error: (err as Error).message });
  }
}

// stdin reader
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.op === 'call') void handleCall(msg);
    } catch (err) {
      process.stderr.write(`bad stdin line: ${(err as Error).message}\n`);
    }
  }
});

/* ──────────── per-account gateway boot ──────────── */

function makeClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  });
}

async function bootAccount(cfg: AccountConfig): Promise<void> {
  const client = makeClient();
  const accountId = cfg.id;

  client.on(Events.MessageCreate, m => {
    const env = messageEnvelope(accountId, m);
    if (env) emitInbound(accountId, env);
  });

  client.on(Events.MessageReactionAdd, async (r, u) => {
    try {
      if (r.partial) await r.fetch();
      if (u.partial) await u.fetch();
    } catch { /* ignore partial fetch failures */ }
    const env = reactionEnvelope(accountId, r as MessageReaction, u as User);
    if (env) emitInbound(accountId, env);
  });

  client.on(Events.MessageUpdate, async (_old, _new) => {
    try {
      const m = _new.partial ? await _new.fetch() : _new as Message;
      if (m.author.bot) return;
      emitInbound(accountId, {
        kind: 'edit',
        id: mintId(),
        ts: new Date(m.editedTimestamp ?? Date.now()).toISOString(),
        station: 'discord',
        line: lineOf(accountId, m.channelId),
        from: `metro://discord/${accountId}/user/${m.author.id}`,
        from_name: m.author.username,
        message_id: m.id,
        text: m.content,
        is_private: m.guildId == null,
        payload: m.toJSON(),
      });
    } catch (err) {
      process.stderr.write(`discord[${accountId}] message update fetch failed: ${(err as Error).message}\n`);
    }
  });

  accounts.set(accountId, { cfg, client });
  await client.login(cfg.token);
  process.stderr.write(`discord[${accountId}] ready — ${client.user?.tag ?? '?'} (owner=${cfg.owner ?? '(broadcast)'})\n`);
}

/* ──────────── boot all accounts ──────────── */

const cfgs = loadAccounts();
for (const cfg of cfgs) {
  try { await bootAccount(cfg); }
  catch (err) { process.stderr.write(`discord[${cfg.id}] boot FAILED: ${(err as Error).message}\n`); }
}
if (accounts.size === 0) { process.stderr.write('discord: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(`discord train ready — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);
