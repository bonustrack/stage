// Discord gateway adapter. DMs forward unconditionally; guild messages
// forward only when the bot is mentioned. Requires the **Message Content
// Intent** privilege in the Developer Portal — without it `messageCreate`
// arrives with an empty `content`.

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";
import { log } from "./log.js";

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not set");
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

export type InboundMessage = { channel_id: string; message_id: string; text: string };

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

function describeAttachments(m: Message): string {
  return [...m.attachments.values()]
    .map(a => {
      if (a.contentType?.startsWith("image/")) return "[image]";
      if (a.contentType?.startsWith("audio/")) return `[audio: ${a.name}]`;
      return `[file: ${a.name}]`;
    })
    .join(" ");
}

export async function startGateway(): Promise<void> {
  const c = getClient();

  c.on(Events.MessageCreate, m => {
    if (m.author.bot) return;
    if (m.guildId && c.user && !m.mentions.has(c.user.id)) return;

    const text = [m.content, describeAttachments(m)].filter(Boolean).join(" ").trim();
    if (!text) return;
    onInboundHandler({ channel_id: m.channelId, message_id: m.id, text });
  });
  c.on(Events.Error, err => log.error({ err: err?.message ?? err }, "discord error"));

  await c.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise<void>(r => c.once(Events.ClientReady, () => r()));
}

export async function getMe(): Promise<{ username: string }> {
  const c = getClient();
  if (!c.user) throw new Error("discord: gateway not ready");
  return { username: c.user.username };
}

async function fetchMessage(channelId: string, messageId: string): Promise<Message> {
  const channel = await getClient().channels.fetch(channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`discord: channel ${channelId} is not text-capable`);
  }
  return channel.messages.fetch(messageId);
}

export async function replyToMessage(channelId: string, messageId: string, text: string): Promise<void> {
  await (await fetchMessage(channelId, messageId)).reply(text);
}

export async function editMessage(channelId: string, messageId: string, text: string): Promise<void> {
  await (await fetchMessage(channelId, messageId)).edit(text);
}

export async function setReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const target = await fetchMessage(channelId, messageId);
  if (emoji) {
    await target.react(emoji);
    return;
  }
  // Clear: only the bot's own reactions, matching Telegram's clear semantics.
  const me = getClient().user;
  if (!me) return;
  for (const r of target.reactions.cache.values()) {
    if (r.users.cache.has(me.id)) await r.users.remove(me.id);
  }
}

export async function fetchAttachments(
  channelId: string,
  messageId: string,
): Promise<Array<{ data: string; mime: string }>> {
  const target = await fetchMessage(channelId, messageId);
  const out: Array<{ data: string; mime: string }> = [];
  for (const a of target.attachments.values()) {
    if (!a.contentType?.startsWith("image/")) continue;
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`discord: download ${a.url}: ${res.status}`);
    out.push({
      data: Buffer.from(await res.arrayBuffer()).toString("base64"),
      mime: a.contentType,
    });
  }
  return out;
}

export async function fetchRecentMessages(
  channelId: string,
  limit: number,
): Promise<Array<{ message_id: string; author: string; text: string; timestamp: string }>> {
  const channel = await getClient().channels.fetch(channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`discord: channel ${channelId} is not text-capable`);
  }
  const msgs = await channel.messages.fetch({ limit: Math.min(Math.max(limit, 1), 100) });
  // Discord returns newest-first; flip for chronological.
  return [...msgs.values()].reverse().map(m => ({
    message_id: m.id,
    author: m.author.username,
    text: m.content,
    timestamp: m.createdAt.toISOString(),
  }));
}
