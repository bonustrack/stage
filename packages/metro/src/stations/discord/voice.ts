// Discord voice — JOIN/LEAVE + live transcription (see voice-transcribe.ts).
// Uses @discordjs/voice joinVoiceChannel() with the guild's voiceAdapterCreator; on Ready we
// arm receive-side transcription. Requires the GuildVoiceStates intent (index.ts) to resolve a
// user's current voice channel from guild.voiceStates.

import {
  joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState,
  type VoiceConnection,
} from '@discordjs/voice';
import type { Client, Guild, VoiceBasedChannel } from 'discord.js';
import { accountFor, accounts } from './accounts.js';
import { respond } from './wire.js';
import { startTranscription, stopTranscription, setTranscription } from './voice-transcribe.js';

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

  // Arm live transcription: subscribe to speakers → whisper → inbound envelopes.
  try { startTranscription(guild.id, channel.id, accountId, client, connection); }
  catch (err) { process.stderr.write(`voice transcription arm failed: ${(err as Error).message}\n`); }

  respond(id, { result: {
    ok: true, account: accountId,
    guildId: guild.id, guildName: guild.name,
    channelId: channel.id, channelName: channel.name,
    status: connection.state.status, transcribing: true,
  } });
}

/** TEMP diagnostic: list voice channels + occupants across shared guilds. */
export async function voiceDebug(id: string, rawArgs: Record<string, unknown>): Promise<void> {
  const args = rawArgs as { account?: string };
  const { accountId, client } = clientFor(args.account);
  const guilds = [...client.guilds.cache.values()].map(g => {
    const voiceChannels = [...g.channels.cache.values()]
      .filter(c => c.isVoiceBased())
      .map(c => ({ id: c.id, name: c.name }));
    const occupants = [...g.voiceStates.cache.values()]
      .filter(vs => vs.channelId)
      .map(vs => ({
        channelId: vs.channelId,
        channelName: vs.channel?.name ?? null,
        userId: vs.id,
        username: vs.member?.user.username ?? null,
      }));
    return { id: g.id, name: g.name, voiceChannels, occupants };
  });
  respond(id, { result: { ok: true, account: accountId, ready: client.isReady(), guilds } });
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
    if (conn) { stopTranscription(gid); conn.destroy(); left.push(gid); }
  }
  respond(id, { result: { ok: true, account: accountId, leftGuilds: left } });
}

/** Toggle live transcription on/off for an active session without leaving the call. */
export async function voiceTranscribe(id: string, rawArgs: Record<string, unknown>): Promise<void> {
  const args = rawArgs as { account?: string; guildId?: string; on?: boolean };
  const { accountId, client } = clientFor(args.account);
  const on = args.on !== false;
  const guildIds = args.guildId ? [args.guildId] : [...client.guilds.cache.keys()];
  const toggled: string[] = [];
  for (const gid of guildIds) if (setTranscription(gid, on)) toggled.push(gid);
  respond(id, { result: { ok: true, account: accountId, on, toggledGuilds: toggled } });
}
