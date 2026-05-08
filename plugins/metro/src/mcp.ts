// MCP tool registration. Tools are namespaced per-platform and registered
// only when their platform is enabled. The agent reads the `platform`,
// `chat_id`, and `channel_id` attributes from inbound <channel> tags and
// passes them back as tool arguments.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import * as discord from "./discord.js";
import * as telegram from "./telegram.js";
import { buildSendBody, tg } from "./telegram.js";

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });

export type Platforms = { telegram: boolean; discord: boolean };

export function buildServer(platforms: Platforms): McpServer {
  const enabled = [platforms.telegram && "Telegram", platforms.discord && "Discord"]
    .filter(Boolean)
    .join(" + ");

  const s = new McpServer(
    { name: "metro", version: pkg.version },
    {
      capabilities: { tools: {} },
      instructions:
        `Metro: ${enabled} channel.\n` +
        "\n" +
        "Inbound messages arrive as JSON lines on stdout of `bun src/tail.ts` running in " +
        "the background — observed via Bash+Monitor on Claude Code, or unified_exec on " +
        "Codex. Each line: " +
        '`{"platform":"telegram"|"discord","chat_id"|"channel_id":"…","message_id":…,"text":"…"}`.\n' +
        "\n" +
        "CRITICAL — visibility: when you handle an inbound message, your FIRST line of " +
        "visible response MUST echo the content so the user sees what arrived. Format:\n" +
        "  [telegram chat_id=<id>] <content>\n" +
        "  [discord channel_id=<id>] <content>\n" +
        "Otherwise the user sees a collapsed Monitor event or a tool call without payload " +
        "and has no idea what message you're handling.\n" +
        "\n" +
        "Then call the matching tool — `telegram-*` for telegram, `discord-*` for discord. " +
        "Pass `chat_id` / `channel_id` and `message_id` verbatim from the inbound.\n" +
        "\n" +
        "Defaults: `reply` for questions, `react` with 👍 for quick acks, `edit-message` " +
        "to update what you already sent, `*-download-attachment` for `[image]` markers " +
        "(voice/audio arrive as opaque `[voice]`/`[audio]`), `discord-fetch-messages` for " +
        "prior context — Discord has no search API for bots.",
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
  const chatId = z
    .union([z.string(), z.number()])
    .describe("Telegram chat_id from the inbound <channel> tag's attribute.");
  const buttons = z
    .array(z.array(z.object({ text: z.string(), url: z.string() })))
    .optional()
    .describe("Inline URL buttons. Outer = rows, inner = buttons in row.");
  const messageId = z.number().int().describe("Telegram message_id from the inbound tag.");
  const sendInputs = { chatId, messageId, text: z.string(), parseMode, disableLinkPreview, buttons };

  s.registerTool(
    "telegram-reply",
    {
      description: "Quote-reply to a Telegram message. Threads under the user's original.",
      inputSchema: sendInputs,
    },
    async ({ chatId, messageId, text, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(chatId, text, { parseMode, disableLinkPreview, buttons });
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
      inputSchema: { chatId, messageId, emoji: z.string() },
    },
    async ({ chatId, messageId, emoji }) => {
      const reaction = emoji ? [{ type: "emoji", emoji }] : [];
      await tg("setMessageReaction", { chat_id: chatId, message_id: messageId, reaction });
      return ok(emoji ? "reacted" : "cleared");
    },
  );

  s.registerTool(
    "telegram-edit-message",
    {
      description: "Edit a Telegram message the bot previously sent.",
      inputSchema: sendInputs,
    },
    async ({ chatId, messageId, text, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(chatId, text, { parseMode, disableLinkPreview, buttons });
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
        "blocks. Resolves recently received messages from Metro's local attachment cache.",
      inputSchema: { chatId, messageId },
    },
    async ({ chatId, messageId }) => {
      const atts = telegram.getCachedAttachments(chatId, messageId);
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
    .describe("Discord channel snowflake from the inbound <channel> tag's attribute.");
  const messageId = z.string().describe("Discord message snowflake from the inbound tag.");

  s.registerTool(
    "discord-reply",
    {
      description: "Reply to a Discord message. Threads under the original.",
      inputSchema: { channelId, messageId, text: z.string() },
    },
    async ({ channelId, messageId, text }) => {
      await discord.replyToMessage(channelId, messageId, text);
      return ok("sent");
    },
  );

  s.registerTool(
    "discord-react",
    {
      description:
        "Set or clear an emoji reaction on a Discord message. Pass '' to clear the bot's " +
        "reactions. `emoji` accepts a unicode character or a custom emoji ID.",
      inputSchema: { channelId, messageId, emoji: z.string() },
    },
    async ({ channelId, messageId, emoji }) => {
      await discord.setReaction(channelId, messageId, emoji);
      return ok(emoji ? "reacted" : "cleared");
    },
  );

  s.registerTool(
    "discord-edit-message",
    {
      description: "Edit a Discord message the bot previously sent.",
      inputSchema: { channelId, messageId, text: z.string() },
    },
    async ({ channelId, messageId, text }) => {
      await discord.editMessage(channelId, messageId, text);
      return ok("edited");
    },
  );

  s.registerTool(
    "discord-download-attachment",
    {
      description:
        "Download image attachments from a Discord message as image content blocks. Works on " +
        "any reachable message. Non-image attachments are skipped.",
      inputSchema: { channelId, messageId },
    },
    async ({ channelId, messageId }) => {
      const atts = await discord.fetchAttachments(channelId, messageId);
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
      const msgs = await discord.fetchRecentMessages(channelId, limit ?? 10);
      const text = msgs
        .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
        .join("\n");
      return ok(text || "(channel is empty)");
    },
  );
}
