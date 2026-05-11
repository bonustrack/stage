/** Discord station: receive via discord.js gateway; send via raw REST (one-shot, no event loop dependency). */

import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { errMsg, log } from '../../log.js';
import * as Line from '../line.js';
import type { Attachment, Capabilities, ChatStation, InboundMessage, Line as LineT, SendOpts } from '../types.js';

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
  if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(`discord ${method} ${path}: ${res.status} ${text}`); }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type DiscordMeta = { inGuild: boolean };

type RawMessage = { id: string; content: string; author: { id: string; username: string; bot?: boolean }; timestamp: string };

/** SUPPRESS_EMBEDS (1 << 2) — strip link unfurls from every bot message. */
const SUPPRESS_EMBEDS = 1 << 2;

const stopComponents = (stopId: string | null | undefined): unknown[] =>
  stopId ? [{ type: 1, components: [{ type: 2, style: 4, label: '⏹', custom_id: stopId }] }] : [];

const channelOf = (line: LineT): string => {
  const id = Line.parseDiscord(line);
  if (!id) throw new Error(`not a discord line: ${line}`);
  return id;
};

export const CAPABILITIES: Capabilities = { in: ['text', 'image'], out: ['text'], features: ['stream', 'edit', 'attachments'] };

export class DiscordStation implements ChatStation<DiscordMeta> {
  readonly name = 'discord';
  readonly capabilities = CAPABILITIES;

  private client: Client | null = null;
  private messageHandler: (m: InboundMessage<DiscordMeta>) => void = () => {};
  private stopHandler: (stopId: string) => Promise<boolean> = async () => false;

  onMessage(handler: (m: InboundMessage<DiscordMeta>) => void): void { this.messageHandler = handler; }
  onStop(handler: (stopId: string) => Promise<boolean>): void { this.stopHandler = handler; }

  private getClient(): Client {
    if (this.client) return this.client;
    this.client = new Client({
      intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel],
    });
    return this.client;
  }

  async start(): Promise<void> {
    const c = this.getClient();
    c.on(Events.MessageCreate, m => { void this.handleMessage(m, c); });
    c.on(Events.InteractionCreate, i => { void this.handleInteraction(i); });
    c.on(Events.Error, err => log.error({ err: errMsg(err) }, 'discord error'));
    await c.login(process.env.DISCORD_BOT_TOKEN);
    await new Promise<void>(r => c.once(Events.ClientReady, () => r()));
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    await this.client.destroy(); this.client = null;
  }

  async getMe(): Promise<{ username: string }> {
    const me = await rest<{ username: string }>('GET', '/users/@me');
    return { username: me.username };
  }

  async send(line: LineT, text: string, opts?: SendOpts): Promise<string> {
    const sent = await rest<{ id: string }>('POST', `/channels/${channelOf(line)}/messages`, {
      content: text, flags: SUPPRESS_EMBEDS, components: stopComponents(opts?.stopId),
    });
    return sent.id;
  }

  async edit(line: LineT, messageId: string, text: string, opts?: SendOpts): Promise<void> {
    await rest('PATCH', `/channels/${channelOf(line)}/messages/${messageId}`, {
      content: text, flags: SUPPRESS_EMBEDS, components: stopComponents(opts?.stopId),
    });
  }

  /** Public thread anchored on `messageId`. Returns the new thread's Line. */
  async createThreadFromMessage(parent: LineT, messageId: string, name: string): Promise<LineT> {
    const created = await rest<{ id: string }>('POST', `/channels/${channelOf(parent)}/messages/${messageId}/threads`, { name, auto_archive_duration: 1440 });
    return Line.discord(created.id);
  }

  /** Catchup-on-restart: fetch messages newer than `afterMessageId` (cap 100). */
  async fetchMessagesSince(line: LineT, afterMessageId: string): Promise<Array<{ messageId: string; text: string; authorIsBot: boolean }>> {
    const msgs = await rest<RawMessage[]>('GET', `/channels/${channelOf(line)}/messages?after=${afterMessageId}&limit=100`);
    return [...msgs].reverse().map(m => ({ messageId: m.id, text: m.content, authorIsBot: !!m.author.bot }));
  }

  private async fetchAttachment(url: string, mediaType: string): Promise<Attachment | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 20 * 1024 * 1024) { log.warn({ url, size: buf.byteLength }, 'discord: attachment too large; skipped'); return null; }
      return { mediaType, data: buf };
    } catch (err) { log.warn({ err: errMsg(err), url }, 'discord: attachment fetch failed'); return null; }
  }

  private async handleMessage(m: import('discord.js').Message, c: Client): Promise<void> {
    if (m.author.bot) return;
    const attachments: Attachment[] = []; const tags: string[] = [];
    for (const a of m.attachments.values()) {
      if (a.contentType?.startsWith('image/')) {
        const fetched = await this.fetchAttachment(a.url, a.contentType);
        if (fetched) attachments.push(fetched); else tags.push('[image]');
      } else tags.push(a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]` : `[file: ${a.name}]`);
    }
    const text = [m.content, ...tags].filter(Boolean).join(' ').trim();
    if (!text && !attachments.length) return;
    log.info({ from: m.author.username, bot: c.user?.username, channel: m.channelId, text: text.slice(0, 80) }, 'discord: inbound');
    this.messageHandler({
      station: 'discord', line: Line.discord(m.channelId), messageId: m.id, text, attachments,
      mentionsBot: c.user ? m.mentions.has(c.user.id) : false,
      meta: { inGuild: !!m.guildId },
    });
  }

  /** Route button clicks (custom_id starts with `stop-`) to the dispatcher's stop handler. */
  private async handleInteraction(i: import('discord.js').Interaction): Promise<void> {
    if (!i.isButton()) return;
    const stopId = i.customId; if (!stopId.startsWith('stop-')) return;
    await i.deferUpdate().catch(err => log.warn({ err: errMsg(err) }, 'discord: deferUpdate failed'));
    const ok = await this.stopHandler(stopId).catch(err => { log.warn({ err: errMsg(err) }, 'discord stop handler threw'); return false; });
    log.debug({ stopId, ok }, 'discord: stop button fired');
  }
}
