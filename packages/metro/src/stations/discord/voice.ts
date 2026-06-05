/** Discord voice — minimal JOIN/LEAVE (presence only, no audio playback yet). */
// Uses @discordjs/voice joinVoiceChannel() with the guild's voiceAdapterCreator.
// Audio streaming (TTS/opus) is a deliberate follow-up (needs native opus + TTS).
// Requires the GuildVoiceStates intent (index.ts) to resolve a user's channel.

import {
  joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState,
  type VoiceConnection,
} from '@discordjs/voice';
import type { Client, Guild, VoiceBasedChannel } from 'discord.js';
import { accountFor, accounts } from './accounts.js';
import { respond } from './wire.js';

/** bonustrack_ (Less) — default target when joinVoice gets no explicit user/channel. */
const DEFAULT_USERNAME = 'bonustrack_';

function clientFor(account?: string): { accountId: string; client: Client } {
  const accountId = accountFor({ account });
  const client = accounts.get(accountId)!.client;
  return { accountId, client };
}

/** Find the voice channel a given user (by id or username) is currently connected to. */
function findUserVoiceChannel(
  client: Client, opts: { userId?: string; username?: string },
): VoiceBasedChannel | null {
  for (const guild of client.guilds.cache.values()) {
    for (const vs of guild.voiceStates.cache.values()) {
      if (!vs.channelId) continue;
      const matchId = opts.userId && vs.id === opts.userId;
      const matchName = opts.username
        && vs.member?.user.username?.toLowerCase() === opts.username.toLowerCase();
      if (matchId || matchName) return vs.channel ?? null;
    }
  }
  return null;
}

async function resolveTarget(
  client: Client, args: { guildId?: string; channelId?: string; userId?: string; username?: string },
): Promise<VoiceBasedChannel> {
  // Explicit channel wins.
  if (args.channelId) {
    const ch = await client.channels.fetch(args.channelId);
    if (!ch || !('guild' in ch) || !ch.isVoiceBased()) {
      throw new Error(`channel ${args.channelId} is not a voice channel`);
    }
    return ch as VoiceBasedChannel;
  }
  // Otherwise locate by user (explicit id/username, else default bonustrack_).
  const ch = findUserVoiceChannel(client, {
    userId: args.userId,
    username: args.userId ? undefined : (args.username ?? DEFAULT_USERNAME),
  });
  if (!ch) {
    const who = args.userId ?? args.username ?? DEFAULT_USERNAME;
    throw new Error(
      `could not find a voice channel for '${who}' — `
      + 'is the user connected to voice in a guild the bot shares, and is the '
      + 'GuildVoiceStates intent enabled? (full daemon restart needed after intent change)');
  }
  return ch;
}

export async function joinVoice(id: string, rawArgs: Record<string, unknown>): Promise<void> {
  const args = rawArgs as {
    account?: string; guildId?: string; channelId?: string; userId?: string; username?: string;
  };
  const { accountId, client } = clientFor(args.account);
  if (!client.isReady()) { respond(id, { error: `gateway not ready for '${accountId}'` }); return; }

  const channel = await resolveTarget(client, args);
  const guild = channel.guild as Guild;

  const connection: VoiceConnection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true, // no audio pipeline yet; stay muted so we don't broadcast silence noise
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    connection.destroy();
    throw new Error(`voice connection failed to become Ready: ${(err as Error).message}`);
  }

  respond(id, { result: {
    ok: true, account: accountId,
    guildId: guild.id, guildName: guild.name,
    channelId: channel.id, channelName: channel.name,
    status: connection.state.status,
  } });
}

export async function leaveVoice(id: string, rawArgs: Record<string, unknown>): Promise<void> {
  const args = rawArgs as { account?: string; guildId?: string };
  const { accountId, client } = clientFor(args.account);

  const guildIds = args.guildId
    ? [args.guildId]
    : [...client.guilds.cache.keys()];
  const left: string[] = [];
  for (const gid of guildIds) {
    const conn = getVoiceConnection(gid);
    if (conn) { conn.destroy(); left.push(gid); }
  }
  respond(id, { result: { ok: true, account: accountId, leftGuilds: left } });
}
