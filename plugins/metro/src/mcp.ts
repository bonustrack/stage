// MCP tool registrations: reply / react / edit-message. All target the user's
// Telegram chat — the bot owner's by default, overridable per-call via `user`.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSendBody, type ChatId, tg } from "./telegram.js";

const DEFAULT_CHAT_ID: ChatId | undefined = (() => {
  const raw = process.env.TELEGRAM_CHAT_ID;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && String(n) === raw ? n : raw;
})();

function resolveChat(user: ChatId | undefined): ChatId {
  const chat = user ?? DEFAULT_CHAT_ID;
  if (chat === undefined) {
    throw new Error("no Telegram chat configured — pass `user` or set TELEGRAM_CHAT_ID");
  }
  return chat;
}

export function buildServer(): McpServer {
  const s = new McpServer(
    { name: "metro", version: "0.3.0" },
    {
      capabilities: { tools: {}, experimental: { "claude/channel": {} } },
      instructions:
        "Telegram channel. Each <channel> tag is a Telegram message from the user. " +
        "Pass the `message_id` attribute as `messageId` to `reply` / `react` / `edit-message`. " +
        "Default: call `reply` for questions, `react` with 👍 for quick acks, `edit-message` to " +
        "update something you already sent.",
    },
  );

  // Telegram parse modes:
  //   HTML        : <b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>
  //   MarkdownV2  : *bold* _italic_ __underline__ ~strike~ ||spoiler|| `code` ```pre``` [text](url)
  //                 (escape _ * [ ] ( ) ~ ` > # + - = | { } . ! with \)
  const parseMode = z.enum(["HTML", "MarkdownV2"]).optional();
  const disableLinkPreview = z.boolean().optional();
  const user = z.union([z.string(), z.number()]).optional();
  const buttons = z
    .array(z.array(z.object({ text: z.string(), url: z.string() })))
    .optional()
    .describe("Inline URL buttons. Outer array = rows, inner array = buttons in that row.");
  const messageId = z
    .number()
    .int()
    .describe("Telegram message_id from the inbound <channel> tag's attribute.");

  s.registerTool(
    "reply",
    {
      description: "Quote-reply to a Telegram message. Threads under the user's original.",
      inputSchema: {
        messageId,
        text: z.string(),
        user,
        parseMode,
        disableLinkPreview,
        buttons,
      },
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(resolveChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
      await tg("sendMessage", body);
      return { content: [{ type: "text", text: "sent" }] };
    },
  );

  s.registerTool(
    "react",
    {
      description:
        "Set or clear an emoji reaction. Pass '' to clear. Telegram restricts private bots to a " +
        "fixed whitelist (👍 ❤️ 🔥 🥰 👏 😁 🤔 🎉 🙏 👌 🤝 💯 🤣 🙈 🤷 …).",
      inputSchema: { messageId, emoji: z.string(), user },
    },
    async ({ messageId, emoji, user }) => {
      const reaction = emoji ? [{ type: "emoji", emoji }] : [];
      await tg("setMessageReaction", { chat_id: resolveChat(user), message_id: messageId, reaction });
      return { content: [{ type: "text", text: emoji ? "reacted" : "cleared" }] };
    },
  );

  s.registerTool(
    "edit-message",
    {
      description: "Edit a message the bot previously sent. Errors if the new text matches the old.",
      inputSchema: {
        messageId,
        text: z.string(),
        user,
        parseMode,
        disableLinkPreview,
        buttons,
      },
    },
    async ({ messageId, text, user, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(resolveChat(user), text, { parseMode, disableLinkPreview, buttons });
      body.message_id = messageId;
      await tg("editMessageText", body);
      return { content: [{ type: "text", text: "edited" }] };
    },
  );

  return s;
}
