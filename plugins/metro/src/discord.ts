// Discord gateway adapter: connects via discord.js, forwards inbound messages
// to the registered handler, and exposes reply / react / edit primitives.
//
// Activated only when DISCORD_BOT_TOKEN is set. DMs forward unconditionally;
// guild channel messages forward only when the bot is mentioned (matches the
// official Discord plugin's default).
//
// Bot setup: enable the **Message Content Intent** in the Discord Developer
// Portal under Bot → Privileged Gateway Intents, otherwise messageCreate
// fires with empty `content` strings and nothing useful arrives.

import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
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
  }
  return client;
}

export type InboundMessage = {
  channel_id: string;
  message_id: string;
  text: string;
};

let onInboundHandler: (msg: InboundMessage) => void = () => {};
export function onInbound(handler: (msg: InboundMessage) => void): void {
  onInboundHandler = handler;
}

function describeAttachments(m: Message): string {
  if (m.attachments.size === 0) return "";
  const tags = m.attachments.map(a => {
    if (a.contentType?.startsWith("image/")) return "[image]";
    if (a.contentType?.startsWith("audio/")) return `[audio: ${a.name}]`;
    return `[file: ${a.name}]`;
  });
  return tags.join(" ");
}

export async function startGateway(): Promise<void> {
  const c = getClient();

  c.on("messageCreate", async m => {
    if (m.author.bot) return;

    // Guild messages: only forward when the bot is mentioned. DMs always pass.
    const isDM = !m.guildId;
    if (!isDM && c.user && !m.mentions.has(c.user.id)) return;

    const parts = [m.content, describeAttachments(m)].filter(Boolean);
    const text = parts.join(" ").trim();
    if (!text) return;

    onInboundHandler({
      channel_id: m.channelId,
      message_id: m.id,
      text,
    });
  });

  c.on("error", err => console.error(`metro: discord error: ${err?.message ?? err}`));

  await c.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise<void>(r => c.once("ready", () => r()));
}

export async function getMe(): Promise<{ username: string }> {
  const c = getClient();
  if (!c.user) throw new Error("discord: gateway not ready (call startGateway first)");
  return { username: c.user.username };
}

async function fetchMessage(channelId: string, messageId: string): Promise<Message> {
  const c = getClient();
  const channel = await c.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`discord: channel ${channelId} is not text-capable`);
  }
  return channel.messages.fetch(messageId);
}

export async function replyToMessage(channelId: string, messageId: string, text: string): Promise<void> {
  const target = await fetchMessage(channelId, messageId);
  await target.reply(text);
}

export async function editMessage(channelId: string, messageId: string, text: string): Promise<void> {
  const target = await fetchMessage(channelId, messageId);
  await target.edit(text);
}

export async function setReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const target = await fetchMessage(channelId, messageId);
  if (emoji) {
    await target.react(emoji);
  } else {
    // Clear only the bot's own reactions (matches the Telegram tool's "clear" semantics).
    const c = getClient();
    if (!c.user) return;
    for (const reaction of target.reactions.cache.values()) {
      if (reaction.users.cache.has(c.user.id)) await reaction.users.remove(c.user.id);
    }
  }
}

export async function fetchAttachments(channelId: string, messageId: string): Promise<Array<{ data: string; mime: string }>> {
  const target = await fetchMessage(channelId, messageId);
  const out: Array<{ data: string; mime: string }> = [];
  for (const a of target.attachments.values()) {
    if (!a.contentType?.startsWith("image/")) continue;
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`discord: download ${a.url}: ${res.status}`);
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    out.push({ data, mime: a.contentType });
  }
  return out;
}

export async function fetchRecentMessages(
  channelId: string,
  limit: number,
): Promise<Array<{ message_id: string; author: string; text: string; timestamp: string }>> {
  const c = getClient();
  const channel = await c.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`discord: channel ${channelId} is not text-capable`);
  }
  const msgs = await channel.messages.fetch({ limit: Math.min(Math.max(limit, 1), 100) });
  return [...msgs.values()]
    .map(m => ({
      message_id: m.id,
      author: m.author.username,
      text: m.content,
      timestamp: m.createdAt.toISOString(),
    }))
    .reverse(); // chronological (Discord returns newest-first)
}
