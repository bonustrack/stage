import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import type { Attachment } from '../agents/types.js';
import { errMsg, log } from '../log.js';

/** Receive: discord.js gateway. Send: raw REST so non-orchestrator callers stay one-shot. */

const API_BASE = 'https://discord.com/api/v10';

function token(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set');
  return t;
}

async function rest<T = unknown>(method: string, path: string, body?: unknown, timeoutMs = 30_000, retriesLeft = 2): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${token()}`,
      'User-Agent': 'metro (https://github.com/bonustrack/metro, dev)',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  /** 429: honor `retry_after` (seconds) and retry, up to a few hops. */
  if (res.status === 429 && retriesLeft > 0) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1;
    log.debug({ path, retryAfter }, 'discord 429; backing off');
    await new Promise(r => setTimeout(r, Math.max(retryAfter * 1000, 250)));
    return rest<T>(method, path, body, timeoutMs, retriesLeft - 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  client = new Client({
    intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    /** DM channels arrive partial; without this messageCreate never fires. */
    partials: [Partials.Channel],
  });
  return client;
}

export type InboundMessage = {
  channel_id: string;
  message_id: string;
  text: string;
  attachments: Attachment[];
  in_guild: boolean;
  mentions_bot: boolean;
};

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export const onInbound = (handler: (msg: InboundMessage) => void): void => { onInboundHandler = handler; };

export async function shutdownGateway(): Promise<void> {
  if (!client) return;
  await client.destroy();
  client = null;
}

/** Fetch an attachment by URL into a Buffer, capped at 20 MB to keep us under agent token limits. */
async function fetchAttachment(url: string, mediaType: string): Promise<Attachment | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 20 * 1024 * 1024) { log.warn({ url, size: buf.byteLength }, 'discord: attachment too large; skipped'); return null; }
    return { mediaType, data: buf };
  } catch (err) { log.warn({ err: errMsg(err), url }, 'discord: attachment fetch failed'); return null; }
}

async function handleMessage(m: import('discord.js').Message, c: Client): Promise<void> {
  if (m.author.bot) return;
  const attachments: Attachment[] = [];
  const tags: string[] = [];
  for (const a of m.attachments.values()) {
    if (a.contentType?.startsWith('image/')) {
      const fetched = await fetchAttachment(a.url, a.contentType);
      if (fetched) attachments.push(fetched);
      else tags.push('[image]');
    } else tags.push(a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]` : `[file: ${a.name}]`);
  }
  const text = [m.content, ...tags].filter(Boolean).join(' ').trim();
  if (!text && !attachments.length) return;
  onInboundHandler({
    channel_id: m.channelId,
    message_id: m.id,
    text,
    attachments,
    in_guild: !!m.guildId,
    mentions_bot: c.user ? m.mentions.has(c.user.id) : false,
  });
}

export async function startGateway(): Promise<void> {
  const c = getClient();
  c.on(Events.MessageCreate, m => { void handleMessage(m, c); });
  c.on(Events.Error, err => log.error({ err: errMsg(err) }, 'discord error'));
  await c.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise<void>(r => c.once(Events.ClientReady, () => r()));
}

export async function getMe(): Promise<{ username: string }> {
  const me = await rest<{ username: string }>('GET', '/users/@me');
  return { username: me.username };
}

type RawMessage = {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
};

/** SUPPRESS_EMBEDS (1 << 2) — strip link unfurls from every bot message. */
const SUPPRESS_EMBEDS = 1 << 2;

export async function sendMessage(channelId: string, text: string): Promise<string> {
  const sent = await rest<{ id: string }>('POST', `/channels/${channelId}/messages`, { content: text, flags: SUPPRESS_EMBEDS });
  return sent.id;
}

/** Public thread anchored on `messageId`. Returns the new thread channel id. */
export async function createThreadFromMessage(channelId: string, messageId: string, name: string): Promise<string> {
  const created = await rest<{ id: string }>('POST', `/channels/${channelId}/messages/${messageId}/threads`, { name, auto_archive_duration: 1440 });
  return created.id;
}

export async function editMessage(channelId: string, messageId: string, text: string): Promise<string> {
  const sent = await rest<{ id: string }>('PATCH', `/channels/${channelId}/messages/${messageId}`, { content: text, flags: SUPPRESS_EMBEDS });
  return sent.id;
}

/** Catchup-on-restart: fetch messages newer than `afterMessageId` (cap 100). */
export async function fetchMessagesSince(channelId: string, afterMessageId: string): Promise<Array<{ message_id: string; text: string; author_id: string; author_is_bot: boolean }>> {
  const msgs = await rest<RawMessage[]>('GET', `/channels/${channelId}/messages?after=${afterMessageId}&limit=100`);
  /** Discord returns newest-first; flip to chronological for replay. */
  return [...msgs].reverse().map(m => ({ message_id: m.id, text: m.content, author_id: m.author.id, author_is_bot: !!m.author.bot }));
}
