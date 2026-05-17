/** Discord station — gateway receive via discord.js, REST for replies/sends/reactions/downloads. */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Client as Gateway, Events, GatewayIntentBits, Partials } from 'discord.js';
import { Line, mintId, type Envelope, type Station } from '@stage-labs/metro';

const API = 'https://discord.com/api/v10';
const SUPPRESS_EMBEDS = 1 << 2;
const MAX_BYTES = 20 * 1024 * 1024;
const UA = 'metro (https://github.com/bonustrack/metro, dev)';

const tok = (): string => {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set');
  return t;
};

async function rest<T = unknown>(method: string, path: string, body?: unknown, retries = 2): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${tok()}`, 'User-Agent': UA,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429 && retries > 0) {
    const after = Number(res.headers.get('retry-after')) || 1;
    await new Promise(r => setTimeout(r, Math.max(after * 1000, 250)));
    return rest<T>(method, path, body, retries - 1);
  }
  if (!res.ok) throw new Error(`discord ${method} ${path}: ${res.status} ${await res.text().catch(() => '')}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function restMultipart<T = unknown>(
  method: string, path: string, payload: unknown, files: { path: string; data: Buffer }[],
): Promise<T> {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  for (const [i, f] of files.entries()) {
    form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)]), basename(f.path));
  }
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'Authorization': `Bot ${tok()}`, 'User-Agent': UA },
    body: form, signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`discord ${method} ${path}: ${res.status} ${await res.text().catch(() => '')}`);
  return (await res.json()) as T;
}

type Button = { text: string; url: string };
type SendArgs = {
  line: string; text: string; replyTo?: string;
  images?: string[]; documents?: string[]; voice?: string; buttons?: Button[][];
};

const discordButtons = (rows: Button[][]): unknown[] => rows.map(row => ({
  type: 1, components: row.map(b => ({ type: 2, style: 5, label: b.text, url: b.url })),
}));

const channelOf = (line: string): string => {
  const id = Line.parseDiscord(line as Line);
  if (!id) throw new Error(`not a discord line: ${line}`);
  return id;
};

const collectFiles = async (a: SendArgs): Promise<{ path: string; data: Buffer }[]> =>
  Promise.all([...(a.images ?? []), ...(a.documents ?? []), ...(a.voice ? [a.voice] : [])]
    .map(async p => ({ path: p, data: await readFile(p) })));

type RawAttachment = { id: string; filename: string; content_type?: string; url: string; size: number };
type RawMessage = {
  id: string; content: string; timestamp: string;
  author: { id: string; username: string; bot?: boolean };
  attachments?: RawAttachment[];
};

let gateway: Gateway | null = null;
let emit: ((e: Envelope) => void) | null = null;

const station: Station = {
  name: 'discord',

  configured: () => !!process.env.DISCORD_BOT_TOKEN,

  async start(e) {
    emit = e;
    gateway = new Gateway({
      intents: [
        GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    });
    gateway.on(Events.MessageCreate, m => { void onMessage(m); });
    gateway.on(Events.MessageReactionAdd, (r, u) => { void onReaction(r, u); });
    await gateway.login(tok());
    await new Promise<void>(resolve => gateway?.once(Events.ClientReady, () => resolve()));
  },

  async stop() {
    if (gateway) await gateway.destroy();
    gateway = null;
    emit = null;
  },

  actions: {
    async reply({ line, messageId, text, ...opts }: SendArgs & { messageId: string }) {
      const id = await sendMessage(line, text, { ...opts, replyTo: messageId });
      return { messageId: id };
    },
    async send({ line, text, ...opts }: SendArgs) {
      const id = await sendMessage(line, text, opts);
      return { messageId: id };
    },
    async react({ line, messageId, emoji }: { line: string; messageId: string; emoji: string }) {
      const ch = channelOf(line);
      if (!emoji) { await rest('DELETE', `/channels/${ch}/messages/${messageId}/reactions/@me`); return { ok: true }; }
      await rest('PUT', `/channels/${ch}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
      return { ok: true };
    },
    async edit({ line, messageId, text, buttons }: { line: string; messageId: string; text: string; buttons?: Button[][] }) {
      const payload: Record<string, unknown> = { content: text, flags: SUPPRESS_EMBEDS };
      payload.components = buttons?.length ? discordButtons(buttons) : [];
      await rest('PATCH', `/channels/${channelOf(line)}/messages/${messageId}`, payload);
      return { ok: true };
    },
    async download({ line, messageId, outDir }: { line: string; messageId: string; outDir: string }) {
      const files = await downloadAttachments(line, messageId, outDir);
      return { files };
    },
    async fetch({ line, limit = 20 }: { line: string; limit?: number }) {
      const cap = Math.max(1, Math.min(100, limit | 0));
      const msgs = await rest<RawMessage[]>('GET', `/channels/${channelOf(line)}/messages?limit=${cap}`);
      return {
        messages: [...msgs].reverse().map(m => ({
          messageId: m.id, author: m.author.username, text: m.content, timestamp: m.timestamp,
        })),
      };
    },
    async getMe() {
      return rest<{ id: string; username: string }>('GET', '/users/@me');
    },
  },
};

async function sendMessage(line: string, text: string, opts: Omit<SendArgs, 'line' | 'text'>): Promise<string> {
  const payload: Record<string, unknown> = { content: text, flags: SUPPRESS_EMBEDS };
  if (opts.replyTo) payload.message_reference = { message_id: opts.replyTo };
  if (opts.buttons?.length) payload.components = discordButtons(opts.buttons);
  const path = `/channels/${channelOf(line)}/messages`;
  const files = await collectFiles({ line, text, ...opts });
  const sent = files.length
    ? await restMultipart<{ id: string }>('POST', path, payload, files)
    : await rest<{ id: string }>('POST', path, payload);
  return sent.id;
}

async function downloadAttachments(line: string, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]> {
  const ch = channelOf(line);
  const msg = await rest<RawMessage>('GET', `/channels/${ch}/messages/${messageId}`);
  const out: { path: string; mediaType: string }[] = [];
  for (const [i, a] of (msg.attachments ?? []).entries()) {
    if (!a.content_type?.startsWith('image/')) continue;
    if (a.size > MAX_BYTES) continue;
    try {
      const res = await fetch(a.url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = join(outDir, `${messageId}-${i}-${a.filename}`);
      await writeFile(path, buf);
      out.push({ path, mediaType: a.content_type });
    } catch { /* ignore individual file failures */ }
  }
  return out;
}

async function onMessage(m: import('discord.js').Message): Promise<void> {
  if (!emit || m.author.bot) return;
  const tags = [...m.attachments.values()].map(a =>
    a.contentType?.startsWith('image/') ? '[image]'
      : a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]` : `[file: ${a.name}]`);
  const text = [m.content.trim(), ...tags].filter(Boolean).join(' ');
  if (!text) return;
  const lineName = m.channel && 'name' in m.channel
    ? (m.channel as { name: string | null }).name ?? undefined : undefined;
  const payload = m.toJSON() as Record<string, unknown> & { referencedMessage?: unknown };
  if (m.reference?.messageId) {
    try { payload.referencedMessage = (await m.fetchReference()).toJSON(); } catch { /* best-effort */ }
  }
  emit({
    id: mintId(), ts: new Date(m.createdTimestamp).toISOString(),
    kind: 'message', station: 'discord', line: Line.discord(m.channelId), lineName,
    from: Line.user('discord', m.author.id), fromName: m.author.username,
    messageId: m.id, text, payload, isPrivate: m.guildId === null,
  });
}

async function onReaction(
  r: import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction,
  u: import('discord.js').User | import('discord.js').PartialUser,
): Promise<void> {
  if (!emit || u.bot) return;
  const emoji = r.emoji.name;
  if (!emoji) return;
  const username = 'username' in u && u.username ? u.username : undefined;
  emit({
    id: mintId(), ts: new Date().toISOString(),
    kind: 'reaction', station: 'discord', line: Line.discord(r.message.channelId),
    from: Line.user('discord', u.id), fromName: username,
    messageId: r.message.id, emoji, isPrivate: r.message.guildId === null,
  });
}

export default station;
