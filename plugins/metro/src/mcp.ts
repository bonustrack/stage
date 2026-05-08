// MCP tool registration. Tools are namespaced per-platform and registered
// only when their platform is enabled. The agent reads the `platform`
// attribute on inbound <channel> tags to pick the matching tool family.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
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
  const c = user ?? TG_DEFAULT_CHAT;
  if (c === undefined) throw new Error("no Telegram chat — pass `user` or set TELEGRAM_CHAT_ID");
  return c;
}

function dcChannel(channel: string | undefined): string {
  const c = channel ?? DC_DEFAULT_CHANNEL;
  if (!c) throw new Error("no Discord channel — pass `channelId` or set DISCORD_CHANNEL_ID");
  return c;
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });

export type Platforms = { telegram: boolean; discord: boolean };

export function buildServer(platforms: Platforms): McpServer {
  const enabled = [platforms.telegram && "Telegram", platforms.discord && "Discord"]
    .filter(Boolean)
    .join(" + ");

  const s = new McpServer(
    { name: "metro", version: pkg.version },
    {
      capabilities: { tools: {}, experimental: { "claude/channel": {} } },
      instructions:
        `${enabled} channel. Each <channel> tag is a message from the user; the ` +
        "`platform` attribute selects which tool family to call. Pass `message_id` " +
        "(and Discord's `channel_id`) verbatim from the tag's attributes. Default: " +
        "reply for questions, react with 👍 for quick acks, edit-message to update " +
        "what you already sent. For `[image]` markers call `*-download-attachment`. " +
        "Voice/audio arrive as opaque `[voice]`/`[audio]` placeholders. Use " +
        "`discord-fetch-messages` for prior context — Discord has no search API for bots.",
    },
  );

  if (platforms.telegram) registerTelegramTools(s);
  if (platforms.discord) registerDiscordTools(s);
  return s;
}

// ----- Telegram -----
// Parse modes: HTML supports <b><i><u><s><a><code><pre><blockquote><tg-spoiler>;
// MarkdownV2 supports *bold* _italic_ __underline__ ~strike~ ||spoiler|| `code`
// ```pre``` [text](url) (escape _*[]()~`>#+-=|{}.! with \).

function registerTelegramTools(s: McpServer): void {
  const parseMode = z.enum(["HTML", "MarkdownV2"]).optional();
  const disableLinkPreview = z.boolean().optional();
  const user = z.union([z.string(), z.number()]).optional();
  const buttons = z
    .array(z.array(z.object({ text: z.string(), url: z.string() })))
    .optional()
    .describe("Inline URL buttons. Outer = rows, inner = buttons in row.");
  const messageId = z.number().int().describe("Telegram message_id from the inbound tag.");
  const sendInputs = { messageId, text: z.string(), user, parseMode, disableLinkPreview, buttons };

  s.registerTool(
    "telegram-reply",
    {
      description: "Quote-reply to a Telegram message. Threads under the user's original.",
      inputSchema: sendInputs,
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(tgChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
      await tg("sendMessage", body);
      return ok("sent");
    },
  );

  s.registerTool(
    "telegram-react",
    {
      description:
        "Set or clear an emoji reaction. Pass '' to clear. Telegram restricts private bots " +
        "to a fixed whitelist (👍 ❤️ 🔥 🥰 👏 😁 🤔 🎉 🙏 👌 💯 🤣 …).",
      inputSchema: { messageId, emoji: z.string(), user },
    },
    async ({ messageId, emoji, user }) => {
      const reaction = emoji ? [{ type: "emoji", emoji }] : [];
      await tg("setMessageReaction", { chat_id: tgChat(user), message_id: messageId, reaction });
      return ok(emoji ? "reacted" : "cleared");
    },
  );

  s.registerTool(
    "telegram-edit-message",
    {
      description: "Edit a Telegram message the bot previously sent.",
      inputSchema: sendInputs,
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(tgChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.message_id = messageId;
      await tg("editMessageText", body);
      return ok("edited");
    },
  );

  s.registerTool(
    "telegram-download-attachment",
    {
      description:
        "Download image attachments from a Telegram message and return them as image content " +
        "blocks. Resolves only messages received during the current session (in-memory cache).",
      inputSchema: { messageId, user },
    },
    async ({ messageId, user }) => {
      const atts = telegram.getCachedAttachments(tgChat(user), messageId);
      if (atts.length === 0) return ok("no cached attachments — message may pre-date this session");
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

// ----- Discord -----
function registerDiscordTools(s: McpServer): void {
  const channelId = z
    .string()
    .optional()
    .describe("Discord channel snowflake. Defaults to DISCORD_CHANNEL_ID.");
  const messageId = z.string().describe("Discord message snowflake from the inbound tag.");

  s.registerTool(
    "discord-reply",
    {
      description: "Reply to a Discord message. Threads under the original.",
      inputSchema: { messageId, text: z.string(), channelId },
    },
    async ({ messageId, text, channelId }) => {
      await discord.replyToMessage(dcChannel(channelId), messageId, text);
      return ok("sent");
    },
  );

  s.registerTool(
    "discord-react",
    {
      description:
        "Set or clear an emoji reaction on a Discord message. Pass '' to clear the bot's " +
        "reactions. `emoji` accepts a unicode character or a custom emoji ID.",
      inputSchema: { messageId, emoji: z.string(), channelId },
    },
    async ({ messageId, emoji, channelId }) => {
      await discord.setReaction(dcChannel(channelId), messageId, emoji);
      return ok(emoji ? "reacted" : "cleared");
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
      return ok("edited");
    },
  );

  s.registerTool(
    "discord-download-attachment",
    {
      description:
        "Download image attachments from a Discord message as image content blocks. Works on " +
        "any reachable message. Non-image attachments are skipped.",
      inputSchema: { messageId, channelId },
    },
    async ({ messageId, channelId }) => {
      const atts = await discord.fetchAttachments(dcChannel(channelId), messageId);
      if (atts.length === 0) return ok("no image attachments on this message");
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
        "messages in chronological order — Discord exposes no search API for bots.",
      inputSchema: {
        channelId,
        limit: z.number().int().min(1).max(100).optional().describe("1–100, default 10."),
      },
    },
    async ({ channelId, limit }) => {
      const msgs = await discord.fetchRecentMessages(dcChannel(channelId), limit ?? 10);
      const text = msgs
        .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
        .join("\n");
      return ok(text || "(channel is empty)");
    },
  );
}
