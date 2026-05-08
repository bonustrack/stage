#!/usr/bin/env bun
// Standalone inbound stream. Polls Telegram + connects to Discord, prints
// one JSON line per inbound message on stdout. Designed to be launched by
// an agent and observed via Bash+Monitor (Claude Code) or unified_exec
// polling (Codex).
//
// Each inbound also fires a 👀 reaction on the source platform — instant
// server-side acknowledgement, independent of the agent. Override with
// METRO_ACK_EMOJI; set empty to disable.

import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform } from './config.js';
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { tg } from './channels/telegram.js';
import { errMsg, log } from './log.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

const ACK = process.env.METRO_ACK_EMOJI ?? '👀';
const emit = (line: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(line)}\n`);

if (platforms.telegram) {
  const me = await telegram.getMe();
  log.info({ bot: `@${me.username}` }, 'telegram ready');
  telegram.onInbound(m => {
    if (ACK) {
      void tg('setMessageReaction', {
        chat_id: m.chat_id,
        message_id: m.message_id,
        reaction: [{ type: 'emoji', emoji: ACK }],
      }).catch(err => log.warn({ err: errMsg(err) }, 'telegram auto-react failed'));
    }
    emit({ platform: 'telegram', chat_id: String(m.chat_id), message_id: m.message_id, text: m.text });
  });
  void telegram.startPolling();
}

if (platforms.discord) {
  await discord.startGateway();
  const me = await discord.getMe();
  log.info({ bot: me.username }, 'discord ready');
  discord.onInbound(m => {
    if (ACK) {
      void discord
        .setReaction(m.channel_id, m.message_id, ACK)
        .catch(err => log.warn({ err: errMsg(err) }, 'discord auto-react failed'));
    }
    emit({ platform: 'discord', channel_id: m.channel_id, message_id: m.message_id, text: m.text });
  });
}

process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
