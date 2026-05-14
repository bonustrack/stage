/** Discord station: receive via discord.js gateway; send/edit/react/download/fetch via REST. */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { errMsg, log } from '../log.js';
import { mintId } from '../history.js';
import {
  Line, type Button, type Capabilities, type ChatStation, type EditOpts, type FetchedMessage,
  type InboundMessage, type Line as LineT, type SendOpts,
} from './index.js';

/** discord.js `Message.toJSON()` output + auto-fetched `referencedMessage` on replies. */
export type DiscordPayload = Record<string, unknown> & { referencedMessage?: unknown };

const API_BASE = 'https://discord.com/api/v10';
const SUPPRESS_EMBEDS = 1 << 2;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const token = (): string => {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set');
  return t;
};

async function rest<T = unknown>(
  method: string, path: string, body?: unknown, timeoutMs = 30_000, retriesLeft = 2,
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
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Multipart upload (payload_json + files[N]). Same retry semantics as `rest`. */
async function restMultipart<T = unknown>(
  method: string, path: string, payload: unknown, files: { path: string; data: Buffer }[],
): Promise<T> {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  for (const [i, f] of files.entries()) {
    form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)]), basename(f.path));
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${token()}`,
      'User-Agent': 'metro (https://github.com/bonustrack/metro, dev)',
    },
    body: form, signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`discord ${method} ${path}: ${res.status} ${t}`);
  }
  return (await res.json()) as T;
}

const collectFiles = async (opts?: SendOpts): Promise<{ path: string; data: Buffer }[]> => {
  const paths = [...(opts?.images ?? []), ...(opts?.documents ?? []), ...(opts?.voice ? [opts.voice] : [])];
  return Promise.all(paths.map(async p => ({ path: p, data: await readFile(p) })));
};

/** Convert button rows to Discord component arrays (URL buttons only — style=5). */
const discordButtons = (rows: Button[][]): unknown[] => rows.map(row => ({
  type: 1, components: row.map(b => ({ type: 2, style: 5, label: b.text, url: b.url })),
}));

type RawAttachment = { id: string; filename: string; content_type?: string; url: string; size: number };
type RawMessage = {
  id: string; content: string; timestamp: string;
  author: { id: string; username: string; bot?: boolean };
  attachments?: RawAttachment[];
};

const channelOf = (line: LineT): string => {
  const id = Line.parseDiscord(line);
  if (!id) throw new Error(`not a discord line: ${line}`);
  return id;
};

const CAPS: Capabilities = {
  in: ['text', 'image'], out: ['text'],
  features: ['reply', 'send', 'edit', 'react', 'download', 'fetch'],
};

export class DiscordStation implements ChatStation<DiscordPayload> {
  readonly name = 'discord';
  readonly capabilities = CAPS;

  private client: Client | null = null;
  private messageHandler: (m: InboundMessage<DiscordPayload>) => void = () => {};

  onMessage(handler: (m: InboundMessage<DiscordPayload>) => void): void {
    this.messageHandler = handler;
  }

  private getClient(): Client {
    return this.client ??= new Client({
      intents: [
        GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });
  }

  async start(): Promise<void> {
    const c = this.getClient();
    c.on(Events.MessageCreate, m => { void this.handleMessage(m); });
    c.on(Events.Error, err => log.error({ err: errMsg(err) }, 'discord error'));
    await c.login(process.env.DISCORD_BOT_TOKEN);
    await new Promise<void>(r => c.once(Events.ClientReady, () => r()));
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    await this.client.destroy();
    this.client = null;
  }

  async getMe(): Promise<{ id: string; username: string }> {
    return rest<{ id: string; username: string }>('GET', '/users/@me');
  }

  async send(line: LineT, text: string, opts?: SendOpts): Promise<string> {
    const payload: Record<string, unknown> = { content: text, flags: SUPPRESS_EMBEDS };
    if (opts?.replyTo) payload.message_reference = { message_id: opts.replyTo };
    if (opts?.buttons?.length) payload.components = discordButtons(opts.buttons);
    const path = `/channels/${channelOf(line)}/messages`;
    const files = await collectFiles(opts);
    const sent = files.length
      ? await restMultipart<{ id: string }>('POST', path, payload, files)
      : await rest<{ id: string }>('POST', path, payload);
    return sent.id;
  }

  async edit(line: LineT, messageId: string, text: string, opts?: EditOpts): Promise<void> {
    const payload: Record<string, unknown> = { content: text, flags: SUPPRESS_EMBEDS };
    payload.components = opts?.buttons?.length ? discordButtons(opts.buttons) : [];
    await rest('PATCH', `/channels/${channelOf(line)}/messages/${messageId}`, payload);
  }

  async react(line: LineT, messageId: string, emoji: string): Promise<void> {
    const ch = channelOf(line);
    if (!emoji) { await rest('DELETE', `/channels/${ch}/messages/${messageId}/reactions/@me`); return; }
    await rest('PUT', `/channels/${ch}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  async download(line: LineT, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]> {
    const ch = channelOf(line);
    const msg = await rest<RawMessage>('GET', `/channels/${ch}/messages/${messageId}`);
    const out: { path: string; mediaType: string }[] = [];
    for (const [i, a] of (msg.attachments ?? []).entries()) {
      if (!a.content_type?.startsWith('image/')) continue;
      if (a.size > MAX_ATTACHMENT_BYTES) {
        log.warn({ size: a.size, name: a.filename }, 'discord: attachment too large; skipped');
        continue;
      }
      try {
        const res = await fetch(a.url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const path = join(outDir, `${messageId}-${i}-${a.filename}`);
        await writeFile(path, buf);
        out.push({ path, mediaType: a.content_type });
      } catch (err) { log.warn({ err: errMsg(err), url: a.url }, 'discord: attachment fetch failed'); }
    }
    return out;
  }

  async fetch(line: LineT, limit: number): Promise<FetchedMessage[]> {
    const capped = Math.max(1, Math.min(100, limit | 0));
    const msgs = await rest<RawMessage[]>('GET', `/channels/${channelOf(line)}/messages?limit=${capped}`);
    return [...msgs].reverse().map(m => ({
      messageId: m.id, author: m.author.username, text: m.content, timestamp: m.timestamp,
    }));
  }

  private async handleMessage(m: import('discord.js').Message): Promise<void> {
    if (m.author.bot) return;
    const tags = [...m.attachments.values()].map(a =>
      a.contentType?.startsWith('image/') ? '[image]'
        : a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]` : `[file: ${a.name}]`);
    const text = [m.content.trim(), ...tags].filter(Boolean).join(' ');
    if (!text) return;
    log.info({ from: m.author.username, channel: m.channelId, text: text.slice(0, 80) }, 'discord: inbound');
    const lineName = m.channel && 'name' in m.channel
      ? (m.channel as { name: string | null }).name ?? undefined : undefined;
    const payload = m.toJSON() as DiscordPayload;
    if (m.reference?.messageId) {
      try { payload.referencedMessage = (await m.fetchReference()).toJSON(); }
      catch (err) { log.debug({ err: errMsg(err) }, 'discord: fetchReference failed'); }
    }
    this.messageHandler({
      id: mintId(), ts: new Date(m.createdTimestamp).toISOString(),
      station: 'discord', line: Line.discord(m.channelId), lineName,
      from: Line.user('discord', m.author.id), fromName: m.author.username,
      messageId: m.id, text, payload,
    });
  }
}
