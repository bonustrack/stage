// MCP tool registration. Tools are namespaced per-platform (telegram-* /
// discord-*) and registered only when their platform is enabled. The agent
// reads the `platform` attribute on inbound <channel> tags and picks the
// matching tool.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as discord from "./discord.js";
import * as telegram from "./telegram.js";
import { buildSendBody, type ChatId, tg } from "./telegram.js";

const TG_DEFAULT_CHAT: ChatId | undefined = (() => {
  const raw = process.env.TELEGRAM_CHAT_ID;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && String(n) === raw ? n : raw;
})();
const DC_DEFAULT_CHANNEL = process.env.DISCORD_CHANNEL_ID;

function tgChat(user: ChatId | undefined): ChatId {
  const chat = user ?? TG_DEFAULT_CHAT;
  if (chat === undefined) throw new Error("no Telegram chat — pass `user` or set TELEGRAM_CHAT_ID");
  return chat;
}
function dcChannel(channel: string | undefined): string {
  const c = channel ?? DC_DEFAULT_CHANNEL;
  if (!c) throw new Error("no Discord channel — pass `channelId` or set DISCORD_CHANNEL_ID");
  return c;
}

export type Platforms = { telegram: boolean; discord: boolean };

export function buildServer(platforms: Platforms): McpServer {
  const enabled = [
    platforms.telegram && "Telegram",
    platforms.discord && "Discord",
  ].filter(Boolean).join(" + ");

  const s = new McpServer(
    { name: "metro", version: "0.5.2" },
    {
      capabilities: { tools: {}, experimental: { "claude/channel": {} } },
      instructions:
        `${enabled} channel. Each <channel> tag is a message from the user. ` +
        "The `platform` attribute identifies the source — use the matching tool family. " +
        "Pass `message_id` (and Discord's `channel_id`) verbatim from the tag's attributes. " +
        "Default: call reply for questions, react with 👍 for quick acks, edit-message to " +
        "update something you already sent. " +
        "If the message body contains `[image]`, call `*-download-attachment` with the " +
        "message_id to actually see what the user sent. Voice/audio messages arrive as " +
        "`[voice]` / `[audio]` placeholders and the bot can't transcribe them — ask the user " +
        "to retype if it matters. Use `discord-fetch-messages` to read earlier context from a " +
        "Discord channel — Discord has no search API for bots.",
    },
  );

  if (platforms.telegram) registerTelegramTools(s);
  if (platforms.discord) registerDiscordTools(s);

  return s;
}

// ----- Telegram tools -----
// Telegram parse modes:
//   HTML        : <b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>
//   MarkdownV2  : *bold* _italic_ __underline__ ~strike~ ||spoiler|| `code` ```pre``` [text](url)
//                 (escape _ * [ ] ( ) ~ ` > # + - = | { } . ! with \)

function registerTelegramTools(s: McpServer): void {
  const parseMode = z.enum(["HTML", "MarkdownV2"]).optional();
  const disableLinkPreview = z.boolean().optional();
  const user = z.union([z.string(), z.number()]).optional();
  const buttons = z
    .array(z.array(z.object({ text: z.string(), url: z.string() })))
    .optional()
    .describe("Inline URL buttons. Outer array = rows, inner array = buttons in that row.");
  const messageId = z.number().int().describe("Telegram message_id from the inbound tag.");

  s.registerTool(
    "telegram-reply",
    {
      description: "Quote-reply to a Telegram message. Threads under the user's original.",
      inputSchema: { messageId, text: z.string(), user, parseMode, disableLinkPreview, buttons },
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(tgChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
      await tg("sendMessage", body);
      return { content: [{ type: "text", text: "sent" }] };
    },
  );

  s.registerTool(
    "telegram-react",
    {
      description:
        "Set or clear an emoji reaction on a Telegram message. Pass '' to clear. Telegram " +
        "restricts private bots to a fixed whitelist (👍 ❤️ 🔥 🥰 👏 😁 🤔 🎉 🙏 👌 💯 🤣 …).",
      inputSchema: { messageId, emoji: z.string(), user },
    },
    async ({ messageId, emoji, user }) => {
      const reaction = emoji ? [{ type: "emoji", emoji }] : [];
      await tg("setMessageReaction", { chat_id: tgChat(user), message_id: messageId, reaction });
      return { content: [{ type: "text", text: emoji ? "reacted" : "cleared" }] };
    },
  );

  s.registerTool(
    "telegram-edit-message",
    {
      description: "Edit a Telegram message the bot previously sent.",
      inputSchema: { messageId, text: z.string(), user, parseMode, disableLinkPreview, buttons },
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(tgChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.message_id = messageId;
      await tg("editMessageText", body);
      return { content: [{ type: "text", text: "edited" }] };
    },
  );

  s.registerTool(
    "telegram-download-attachment",
    {
      description:
        "Download image attachments from an inbound Telegram message and return them as " +
        "image content blocks the agent can see. Only resolves messages received during the " +
        "current plugin session (file_ids cached in memory). Voice/audio is auto-transcribed " +
        "on receipt — call this only for images.",
      inputSchema: { messageId, user },
    },
    async ({ messageId, user }) => {
      const atts = telegram.getCachedAttachments(tgChat(user), messageId);
      if (atts.length === 0) {
        return {
          content: [{
            type: "text",
            text: "no cached attachments for this message — it may pre-date this plugin session, or be text-only",
          }],
        };
      }
      const blocks = await Promise.all(
        atts.map(async a => {
          const { data, mime } = await telegram.downloadAttachment(a.file_id, a.mime);
          return { type: "image" as const, data, mimeType: mime };
        }),
      );
      return { content: blocks };
    },
  );
}

// ----- Discord tools -----
function registerDiscordTools(s: McpServer): void {
  const channelId = z
    .string()
    .optional()
    .describe("Discord channel snowflake. Defaults to DISCORD_CHANNEL_ID.");
  const messageId = z.string().describe("Discord message snowflake from the inbound tag.");

  s.registerTool(
    "discord-reply",
    {
      description: "Reply to a Discord message. The reply is threaded under the original.",
      inputSchema: { messageId, text: z.string(), channelId },
    },
    async ({ messageId, text, channelId }) => {
      await discord.replyToMessage(dcChannel(channelId), messageId, text);
      return { content: [{ type: "text", text: "sent" }] };
    },
  );

  s.registerTool(
    "discord-react",
    {
      description:
        "Add or clear an emoji reaction on a Discord message. Pass '' to remove the bot's " +
        "reactions. `emoji` accepts a unicode character (👍) or a custom emoji ID.",
      inputSchema: { messageId, emoji: z.string(), channelId },
    },
    async ({ messageId, emoji, channelId }) => {
      await discord.setReaction(dcChannel(channelId), messageId, emoji);
      return { content: [{ type: "text", text: emoji ? "reacted" : "cleared" }] };
    },
  );

  s.registerTool(
    "discord-edit-message",
    {
      description: "Edit a Discord message the bot previously sent.",
      inputSchema: { messageId, text: z.string(), channelId },
    },
    async ({ messageId, text, channelId }) => {
      await discord.editMessage(dcChannel(channelId), messageId, text);
      return { content: [{ type: "text", text: "edited" }] };
    },
  );

  s.registerTool(
    "discord-download-attachment",
    {
      description:
        "Download image attachments from a Discord message and return them as image content " +
        "blocks the agent can see. Works on any reachable message, not just ones received this " +
        "session. Non-image attachments are skipped.",
      inputSchema: { messageId, channelId },
    },
    async ({ messageId, channelId }) => {
      const atts = await discord.fetchAttachments(dcChannel(channelId), messageId);
      if (atts.length === 0) return { content: [{ type: "text", text: "no image attachments on this message" }] };
      return {
        content: atts.map(a => ({ type: "image" as const, data: a.data, mimeType: a.mime })),
      };
    },
  );

  s.registerTool(
    "discord-fetch-messages",
    {
      description:
        "Fetch recent messages from a Discord channel for context. Returns up to `limit` " +
        "messages in chronological order. Use this when the agent needs to look back at the " +
        "conversation — Discord has no search API for bots, so this is the only lookback path.",
      inputSchema: {
        channelId,
        limit: z.number().int().min(1).max(100).optional()
          .describe("Number of messages to fetch (1-100, default 10)."),
      },
    },
    async ({ channelId, limit }) => {
      const msgs = await discord.fetchRecentMessages(dcChannel(channelId), limit ?? 10);
      const formatted = msgs
        .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
        .join("\n");
      return { content: [{ type: "text", text: formatted || "(channel is empty)" }] };
    },
  );
}
