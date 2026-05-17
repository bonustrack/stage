/**
 * Discord train. Subscribes to one bot account via discord.js, projects every inbound message
 * (and reaction) to a metro envelope on stdout. Reads action calls on stdin: send/edit/react.
 *
 * Setup:
 *   cd ~/.metro && bun init -y && bun add discord.js
 *   cp <this-file> ~/.metro/trains/discord.ts
 *   echo 'DISCORD_BOT_TOKEN=your-token' >> ~/.metro/.env
 *
 * Edit freely. Metro does not load this file — it spawns it. Action names and payload shapes
 * are entirely your choice; whatever the agent calls with `metro call discord <action> <args>`
 * is what arrives on stdin.
 */

import { Client, Events, GatewayIntentBits, Partials, type Message } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) { process.stderr.write('DISCORD_BOT_TOKEN unset\n'); process.exit(2); }

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

function emit(event: unknown): void { process.stdout.write(JSON.stringify(event) + '\n'); }
function respond(id: string, body: { result?: unknown; error?: string }): void {
  process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
}

const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;

function envelope(m: Message): Record<string, unknown> {
  const tags = [...m.attachments.values()].map(a =>
    a.contentType?.startsWith('image/') ? '[image]'
      : a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]` : `[file: ${a.name}]`);
  const text = [m.content.trim(), ...tags].filter(Boolean).join(' ');
  return {
    kind: 'inbound',
    id: mintId(),
    ts: new Date(m.createdTimestamp).toISOString(),
    station: 'discord',
    line: `metro://discord/${m.channelId}`,
    lineName: 'name' in (m.channel ?? {}) ? (m.channel as { name?: string | null }).name ?? undefined : undefined,
    from: `metro://discord/user/${m.author.id}`,
    fromName: m.author.username,
    messageId: m.id,
    text,
    isPrivate: m.guildId === null,
    payload: m.toJSON(),
  };
}

client.on(Events.MessageCreate, m => { if (!m.author.bot) emit(envelope(m)); });

client.on(Events.MessageReactionAdd, (r, u) => {
  if (u.bot || !r.emoji.name) return;
  emit({
    kind: 'react',
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'discord',
    line: `metro://discord/${r.message.channelId}`,
    from: `metro://discord/user/${u.id}`,
    fromName: 'username' in u ? u.username : undefined,
    messageId: r.message.id,
    emoji: r.emoji.name,
    isPrivate: r.message.guildId === null,
  });
});

const API = 'https://discord.com/api/v10';
async function rest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${TOKEN}`,
      'User-Agent': 'metro-train',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`discord ${method} ${path}: ${res.status} ${await res.text().catch(() => '')}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const channelOf = (line: string): string => {
  const m = line.match(/^metro:\/\/discord\/([^/]+)/);
  if (!m) throw new Error(`bad discord line: ${line}`);
  return m[1];
};

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

async function handleCall(call: CallMsg): Promise<void> {
  const { id, action, args } = call;
  try {
    if (action === 'send') {
      const { line, text, replyTo } = args as { line: string; text: string; replyTo?: string };
      const payload: Record<string, unknown> = { content: text, flags: 1 << 2 };
      if (replyTo) payload.message_reference = { message_id: replyTo };
      const sent = await rest<{ id: string }>('POST', `/channels/${channelOf(line)}/messages`, payload);
      respond(id, { result: { messageId: sent.id } });
    } else if (action === 'edit') {
      const { line, messageId, text } = args as { line: string; messageId: string; text: string };
      await rest('PATCH', `/channels/${channelOf(line)}/messages/${messageId}`, { content: text, flags: 1 << 2 });
      respond(id, { result: { ok: true } });
    } else if (action === 'react') {
      const { line, messageId, emoji } = args as { line: string; messageId: string; emoji: string };
      const ch = channelOf(line);
      if (emoji) await rest('PUT', `/channels/${ch}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
      else await rest('DELETE', `/channels/${ch}/messages/${messageId}/reactions/@me`);
      respond(id, { result: { ok: true } });
    } else {
      respond(id, { error: `unknown action '${action}' (have: send, edit, react)` });
    }
  } catch (err) {
    respond(id, { error: (err as Error).message });
  }
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
    try {
      const msg = JSON.parse(line);
      if (msg.op === 'call') void handleCall(msg);
    } catch (err) {
      process.stderr.write(`bad stdin line: ${(err as Error).message}\n`);
    }
  }
});

await client.login(TOKEN);
process.stderr.write(`discord train ready (bot ${client.user?.username})\n`);
