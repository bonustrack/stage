import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { buildSendBody, tg } from './channels/telegram.js';
import { configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './config.js';
import { errMsg, log } from './log.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

// Tell tail.ts to stop refreshing typing for this chat (the agent has replied).
const TYPING_DIR = join(STATE_DIR, '.typing-stop');
function signalReplyComplete(platform: 'telegram' | 'discord', chat: string): void {
  try {
    mkdirSync(TYPING_DIR, { recursive: true });
    writeFileSync(join(TYPING_DIR, `${platform}_${chat}`), '');
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'typing stop-signal write failed');
  }
}

// Discord tools need a logged-in client for REST calls; warm the gateway in
// the background so MCP stdio binds before discord.js's slow handshake. Tool
// handlers below await `discordReady` before touching the client.
const discordReady: Promise<unknown> = platforms.discord
  ? discord.startGateway().catch(err => log.warn({ err: errMsg(err) }, 'discord gateway warmup failed'))
  : Promise.resolve();

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const enabled = [platforms.telegram && 'Telegram', platforms.discord && 'Discord']
  .filter(Boolean)
  .join(' + ');

const server = new McpServer(
  { name: 'metro', version: pkg.version },
  {
    capabilities: { tools: {} },
    instructions:
      `Metro: ${enabled} channel.\n\n` +
      'Inbound messages arrive as JSON lines on stdout of `metro tail` running in ' +
      'the background (Bash+Monitor on Claude Code, unified_exec on Codex). Each line: ' +
      '`{"platform":"telegram"|"discord","chat_id"|"channel_id":"…","message_id":…,"text":"…"}`.\n\n' +
      'VISIBILITY: when handling an inbound message, your FIRST visible line MUST echo ' +
      'the content so the user sees what arrived:\n' +
      '  [telegram chat_id=<id>] <content>\n' +
      '  [discord channel_id=<id>] <content>\n\n' +
      'Then call the matching tool — `telegram-*` or `discord-*` — passing `chat_id`, ' +
      '`channel_id`, and `message_id` verbatim from the inbound. Defaults: `reply` for ' +
      'questions, `react` 👍 for quick acks, `edit-message` to update, ' +
      '`*-download-attachment` for `[image]` markers (voice/audio are opaque), ' +
      '`discord-fetch-messages` for prior context.',
  },
);

const parseMode = z.enum(['HTML', 'MarkdownV2']).optional();
const disableLinkPreview = z.boolean().optional();
const buttons = z
  .array(z.array(z.object({ text: z.string(), url: z.string() })))
  .optional()
  .describe('Inline URL buttons. Outer = rows, inner = buttons in row.');

if (platforms.telegram) {
  const chatId = z.union([z.string(), z.number()]).describe('Telegram chat_id from the inbound tag.');
  const messageId = z.number().int().describe('Telegram message_id from the inbound tag.');
  const sendInputs = { chatId, messageId, text: z.string(), parseMode, disableLinkPreview, buttons };

  server.registerTool(
    'telegram-reply',
    { description: "Quote-reply to a Telegram message. Threads under the user's original.", inputSchema: sendInputs },
    async ({ chatId, messageId, text, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(chatId, text, { parseMode, disableLinkPreview, buttons });
      body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
      await tg('sendMessage', body);
      signalReplyComplete('telegram', String(chatId));
      // Clear the auto-acknowledgement emoji on the specific message we replied to.
      await tg('setMessageReaction', { chat_id: chatId, message_id: messageId, reaction: [] }).catch(
        err => log.warn({ err: errMsg(err) }, 'telegram clear-reaction failed'),
      );
      return ok('sent');
    },
  );

  server.registerTool(
    'telegram-react',
    {
      description:
        "Set or clear an emoji reaction. Pass '' to clear. Telegram's bot whitelist: " +
        '👍 ❤️ 🔥 🥰 👏 😁 🤔 🎉 🙏 👌 💯 🤣 …',
      inputSchema: { chatId, messageId, emoji: z.string() },
    },
    async ({ chatId, messageId, emoji }) => {
      const reaction = emoji ? [{ type: 'emoji', emoji }] : [];
      await tg('setMessageReaction', { chat_id: chatId, message_id: messageId, reaction });
      return ok(emoji ? 'reacted' : 'cleared');
    },
  );

  server.registerTool(
    'telegram-edit-message',
    { description: 'Edit a Telegram message the bot previously sent.', inputSchema: sendInputs },
    async ({ chatId, messageId, text, parseMode, disableLinkPreview, buttons }) => {
      const body = buildSendBody(chatId, text, { parseMode, disableLinkPreview, buttons });
      body.message_id = messageId;
      await tg('editMessageText', body);
      return ok('edited');
    },
  );

  server.registerTool(
    'telegram-download-attachment',
    {
      description: 'Download image attachments as image content blocks.',
      inputSchema: { chatId, messageId },
    },
    async ({ chatId, messageId }) => {
      const atts = telegram.getCachedAttachments(chatId, messageId);
      if (atts.length === 0) return ok('no cached attachments — message may pre-date this session');
      const blocks = await Promise.all(
        atts.map(async a => {
          const { data, mime } = await telegram.downloadAttachment(a.file_id, a.mime);
          return { type: 'image' as const, data, mimeType: mime };
        }),
      );
      return { content: blocks };
    },
  );
}

if (platforms.discord) {
  const channelId = z.string().describe('Discord channel snowflake from the inbound tag.');
  const messageId = z.string().describe('Discord message snowflake from the inbound tag.');

  server.registerTool(
    'discord-reply',
    {
      description: 'Reply to a Discord message. Threads under the original.',
      inputSchema: { channelId, messageId, text: z.string() },
    },
    async ({ channelId, messageId, text }) => {
      await discordReady;
      await discord.replyToMessage(channelId, messageId, text);
      signalReplyComplete('discord', channelId);
      // Clear the auto-acknowledgement emoji on the specific message we replied to.
      await discord
        .setReaction(channelId, messageId, '')
        .catch(err => log.warn({ err: errMsg(err) }, 'discord clear-reaction failed'));
      return ok('sent');
    },
  );

  server.registerTool(
    'discord-react',
    {
      description: "Set or clear an emoji reaction on a Discord message. Pass '' to clear.",
      inputSchema: { channelId, messageId, emoji: z.string() },
    },
    async ({ channelId, messageId, emoji }) => {
      await discordReady;
      await discord.setReaction(channelId, messageId, emoji);
      return ok(emoji ? 'reacted' : 'cleared');
    },
  );

  server.registerTool(
    'discord-edit-message',
    {
      description: 'Edit a Discord message the bot previously sent.',
      inputSchema: { channelId, messageId, text: z.string() },
    },
    async ({ channelId, messageId, text }) => {
      await discordReady;
      await discord.editMessage(channelId, messageId, text);
      return ok('edited');
    },
  );

  server.registerTool(
    'discord-download-attachment',
    {
      description: 'Download image attachments as image content blocks. Non-images are skipped.',
      inputSchema: { channelId, messageId },
    },
    async ({ channelId, messageId }) => {
      await discordReady;
      const atts = await discord.fetchAttachments(channelId, messageId);
      if (atts.length === 0) return ok('no image attachments on this message');
      return { content: atts.map(a => ({ type: 'image' as const, data: a.data, mimeType: a.mime })) };
    },
  );

  server.registerTool(
    'discord-fetch-messages',
    {
      description: 'Fetch recent messages for context — Discord has no search API for bots.',
      inputSchema: {
        channelId,
        limit: z.number().int().min(1).max(100).optional().describe('1–100, default 10.'),
      },
    },
    async ({ channelId, limit }) => {
      await discordReady;
      const msgs = await discord.fetchRecentMessages(channelId, limit ?? 10);
      const text = msgs
        .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
        .join('\n');
      return ok(text || '(channel is empty)');
    },
  );
}

await server.server.connect(new StdioServerTransport());
process.stdin.on('end', () => process.exit(0)).on('close', () => process.exit(0));
