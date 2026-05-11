import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { errMsg, log } from '../log.js';

// Receive path: discord.js gateway, owned by the orchestrator.
// Send path: raw REST against discord.com/api — no gateway login required,
// so callers outside the orchestrator (e.g. cli.ts validation) stay one-shot.

const API_BASE = 'https://discord.com/api/v10';

function token(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set');
  return t;
}

async function rest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
  retriesLeft = 2,
): Promise<T> {
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
  // 429: honor Discord's retry_after (seconds) and try again, up to a few
  // hops. Common during streaming edits when the agent emits deltas faster
  // than the per-channel edit cap.
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
  // 204 No Content for typing/reactions/clear.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Receive path (gateway, discord.js) -----------------------------

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  client = new Client({
    intents: [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    // DM channels arrive partial; without this messageCreate never fires.
    partials: [Partials.Channel],
  });
  return client;
}

export type InboundMessage = {
  channel_id: string;
  message_id: string;
  text: string;
  /** True for guild text channels / threads; false for DMs. */
  in_guild: boolean;
  /** True when the bot user was @-mentioned in this message. */
  mentions_bot: boolean;
};

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

export async function shutdownGateway(): Promise<void> {
  if (!client) return;
  await client.destroy();
  client = null;
}

export async function startGateway(): Promise<void> {
  const c = getClient();

  c.on(Events.MessageCreate, m => {
    if (m.author.bot) return;
    // Forward every human message; the orchestrator decides what to route
    // where (scoped thread vs new bootstrap mention vs ignore). The bot's
    // own @-mention is preserved in `m.content` so the orchestrator can
    // make that decision from the same payload.
    const tags = [...m.attachments.values()]
      .map(a => {
        if (a.contentType?.startsWith('image/')) return '[image]';
        if (a.contentType?.startsWith('audio/')) return `[audio: ${a.name}]`;
        return `[file: ${a.name}]`;
      })
      .join(' ');
    const text = [m.content, tags].filter(Boolean).join(' ').trim();
    if (!text) return;
    onInboundHandler({
      channel_id: m.channelId,
      message_id: m.id,
      text,
      in_guild: !!m.guildId,
      mentions_bot: c.user ? m.mentions.has(c.user.id) : false,
    });
  });
  c.on(Events.Error, err => log.error({ err: errMsg(err) }, 'discord error'));

  await c.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise<void>(r => c.once(Events.ClientReady, () => r()));
}

export async function getMe(): Promise<{ username: string }> {
  const me = await rest<{ username: string }>('GET', '/users/@me');
  return { username: me.username };
}

// ---------- Send path (REST, no gateway) -----------------------------------

type RawMessage = {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
};

export async function sendMessage(channelId: string, text: string): Promise<string> {
  const sent = await rest<{ id: string }>('POST', `/channels/${channelId}/messages`, { content: text });
  return sent.id;
}

/**
 * Create a public thread anchored to an existing message. The user's
 * @-mention becomes the thread's starter, so the thread is visually
 * tied to the request that opened it. Returns the new thread's channel id.
 */
export async function createThreadFromMessage(channelId: string, messageId: string, name: string): Promise<string> {
  const created = await rest<{ id: string }>('POST', `/channels/${channelId}/messages/${messageId}/threads`, {
    name,
    auto_archive_duration: 1440,
  });
  return created.id;
}

export async function editMessage(channelId: string, messageId: string, text: string): Promise<string> {
  const sent = await rest<{ id: string }>('PATCH', `/channels/${channelId}/messages/${messageId}`, { content: text });
  return sent.id;
}

/**
 * Fetch all messages newer than `afterMessageId` in a channel. Used for
 * catchup-on-restart so messages sent while metro was down still get a
 * reply once it comes back. Caps at 100 messages — anything older than
 * that during downtime is dropped on the floor.
 */
export async function fetchMessagesSince(
  channelId: string,
  afterMessageId: string,
): Promise<Array<{ message_id: string; text: string; author_id: string; author_is_bot: boolean }>> {
  const msgs = await rest<RawMessage[]>(
    'GET',
    `/channels/${channelId}/messages?after=${afterMessageId}&limit=100`,
  );
  // Discord returns newest-first; flip to chronological so replay order
  // matches what the user actually typed.
  return [...msgs].reverse().map(m => ({
    message_id: m.id,
    text: m.content,
    author_id: m.author.id,
    author_is_bot: !!m.author.bot,
  }));
}
