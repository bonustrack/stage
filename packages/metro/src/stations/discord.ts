/** Discord station: receive via discord.js gateway; send/edit/react/download/fetch via REST. */

import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { errMsg, log } from '../log.js';
import { mintId } from '../history.js';
import { rest, restMultipart } from './discord-rest.js';
import { synthDiscordText } from './discord-synth.js';
import {
  Line, type Button, type ChatStation, type EditOpts, type FetchedMessage,
  type InboundEdit, type InboundMessage, type InboundReaction, type SendOpts,
} from './index.js';

/** discord.js `Message.toJSON()` output + auto-fetched `referencedMessage` on replies. */
export type DiscordPayload = Record<string, unknown> & { referencedMessage?: unknown };

const SUPPRESS_EMBEDS = 1 << 2;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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

const channelOf = (line: Line): string => {
  const id = Line.parseDiscord(line);
  if (!id) throw new Error(`not a discord line: ${line}`);
  return id;
};

export class DiscordStation implements ChatStation<DiscordPayload> {
  readonly name = 'discord';

  private client: Client | null = null;
  private messageHandler: (m: InboundMessage<DiscordPayload>) => void = () => {};
  private reactionHandler: (r: InboundReaction) => void = () => {};
  private editHandler: (e: InboundEdit<DiscordPayload>) => void = () => {};

  onMessage(handler: (m: InboundMessage<DiscordPayload>) => void): void {
    this.messageHandler = handler;
  }
  onReaction(handler: (r: InboundReaction) => void): void { this.reactionHandler = handler; }
  onEdit(handler: (e: InboundEdit<DiscordPayload>) => void): void { this.editHandler = handler; }

  private getClient(): Client {
    return this.client ??= new Client({
      intents: [
        GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    });
  }

  async start(): Promise<void> {
    const c = this.getClient();
    c.on(Events.MessageCreate, m => { void this.handleMessage(m); });
    c.on(Events.MessageReactionAdd, (r, u) => { void this.handleReaction(r, u, '+'); });
    c.on(Events.MessageReactionRemove, (r, u) => { void this.handleReaction(r, u, '-'); });
    c.on(Events.MessageUpdate, (_o, n) => { void this.handleEdit(n, false); });
    c.on(Events.MessageDelete, m => { void this.handleEdit(m, true); });
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

  async send(line: Line, text: string, opts?: SendOpts): Promise<string> {
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

  async edit(line: Line, messageId: string, text: string, opts?: EditOpts): Promise<void> {
    const payload: Record<string, unknown> = { content: text, flags: SUPPRESS_EMBEDS };
    payload.components = opts?.buttons?.length ? discordButtons(opts.buttons) : [];
    await rest('PATCH', `/channels/${channelOf(line)}/messages/${messageId}`, payload);
  }

  async react(line: Line, messageId: string, emoji: string): Promise<void> {
    const ch = channelOf(line);
    if (!emoji) { await rest('DELETE', `/channels/${ch}/messages/${messageId}/reactions/@me`); return; }
    await rest('PUT', `/channels/${ch}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  async download(line: Line, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]> {
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

  async fetch(line: Line, limit: number): Promise<FetchedMessage[]> {
    const capped = Math.max(1, Math.min(100, limit | 0));
    const msgs = await rest<RawMessage[]>('GET', `/channels/${channelOf(line)}/messages?limit=${capped}`);
    return [...msgs].reverse().map(m => ({
      messageId: m.id, author: m.author.username, text: m.content, timestamp: m.timestamp,
    }));
  }

  private async handleReaction(
    r: import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction,
    u: import('discord.js').User | import('discord.js').PartialUser,
    sign: '+' | '-',
  ): Promise<void> {
    if (u.bot) return;
    const emojiName = r.emoji.name;
    if (!emojiName) return;
    const emoji = sign === '-' ? '' : emojiName;
    const channelId = r.message.channelId;
    const messageId = r.message.id;
    const username = 'username' in u && u.username ? u.username : undefined;
    log.info({ from: username, channel: channelId, emoji: emojiName, sign, messageId }, 'discord: reaction');
    this.reactionHandler({
      id: mintId(), ts: new Date().toISOString(),
      station: 'discord', line: Line.discord(channelId),
      from: Line.user('discord', u.id), fromName: username,
      messageId, emoji, isPrivate: r.message.guildId === null,
    });
  }

  private async handleEdit(
    m: import('discord.js').Message | import('discord.js').PartialMessage, deleted: boolean,
  ): Promise<void> {
    if (m.author?.bot) return;
    const channelId = m.channelId;
    if (!channelId) return;
    const text = deleted ? '' : (m.partial ? '' : synthDiscordText(m as import('discord.js').Message));
    const payload = (m.partial ? { id: m.id } : (m as import('discord.js').Message).toJSON()) as DiscordPayload;
    log.info({ channel: channelId, messageId: m.id, deleted, text: text.slice(0, 80) }, 'discord: edit');
    this.editHandler({
      id: mintId(), ts: new Date().toISOString(),
      station: 'discord', line: Line.discord(channelId),
      from: m.author ? Line.user('discord', m.author.id) : Line.user('discord', 'unknown'),
      fromName: m.author?.username, messageId: m.id,
      text, payload, isPrivate: m.guildId === null, deleted,
    });
  }

  private async handleMessage(m: import('discord.js').Message): Promise<void> {
    if (m.author.bot) return;
    const text = synthDiscordText(m);
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
      messageId: m.id, text, payload, isPrivate: m.guildId === null,
    });
  }
}
