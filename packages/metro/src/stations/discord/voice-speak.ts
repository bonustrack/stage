/** Discord voice-out — speak TTS into the active voice connection. */
// Pipeline: macOS `say` → AIFF, ffmpeg → OGG/Opus, @discordjs/voice plays the
// pre-encoded opus (StreamType.OggOpus) so NO native opus encoder is needed.
// Text is passed via argv to `say` (no shell), avoiding shell injection.

import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import {
  createAudioPlayer, createAudioResource, getVoiceConnection, entersState,
  AudioPlayerStatus, StreamType, NoSubscriberBehavior,
  type VoiceConnection,
} from '@discordjs/voice';
import type { Client } from 'discord.js';
import { accountFor, accounts, routeOf } from './accounts.js';
import { respond } from './wire.js';

const TTS_VOICE = 'Samantha';

function clientFor(account?: string): { accountId: string; client: Client } {
  const accountId = accountFor({ account });
  return { accountId, client: accounts.get(accountId)!.client };
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr?.on('data', d => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', code => code === 0
      ? resolve()
      : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`)));
  });
}

/** Resolve the guild's active VoiceConnection (from a prior joinVoice). */
function resolveConnection(
  client: Client, args: { channelId?: string; line?: string; account?: string },
): { conn: VoiceConnection; channelName: string } | { error: string } {
  // If a channelId/line is given, map it to its guild and use that connection.
  let channelId = args.channelId;
  if (!channelId && args.line) {
    try { channelId = routeOf(args.line, args.account).channelId; } catch { /* ignore */ }
  }
  if (channelId) {
    const ch = client.channels.cache.get(channelId);
    const gid = ch && 'guildId' in ch ? (ch as { guildId: string }).guildId : undefined;
    if (gid) {
      const conn = getVoiceConnection(gid);
      if (conn) {
        const name = ch && 'name' in ch ? String((ch as { name?: string }).name) : gid;
        return { conn, channelName: name };
      }
    }
  }
  // Default: the single active connection across shared guilds.
  for (const guild of client.guilds.cache.values()) {
    const conn = getVoiceConnection(guild.id);
    if (conn) {
      const chId = (conn.joinConfig as { channelId?: string }).channelId;
      const ch = chId ? client.channels.cache.get(chId) : undefined;
      const name = ch && 'name' in ch ? String((ch as { name?: string }).name) : guild.name;
      return { conn, channelName: name };
    }
  }
  return { error: 'no active voice connection — run joinVoice first' };
}

export async function speak(id: string, rawArgs: Record<string, unknown>): Promise<void> {
  const args = rawArgs as {
    account?: string; text?: string; channelId?: string; line?: string; voice?: string;
  };
  const text = (args.text ?? '').trim();
  if (!text) { respond(id, { result: { ok: false, error: 'text is required' } }); return; }

  const { accountId, client } = clientFor(args.account);
  if (!client.isReady()) {
    respond(id, { result: { ok: false, error: `gateway not ready for '${accountId}'` } });
    return;
  }

  const resolved = resolveConnection(client, args);
  if ('error' in resolved) { respond(id, { result: { ok: false, error: resolved.error } }); return; }
  const { conn, channelName } = resolved;

  const ts = Date.now();
  const aiff = `/tmp/metro-tts-${ts}.aiff`;
  const ogg = `/tmp/metro-tts-${ts}.ogg`;
  const cleanup = async () => {
    await Promise.allSettled([unlink(aiff), unlink(ogg)]);
  };

  try {
    // 1. say → AIFF (text via argv, never the shell).
    await run('say', ['-v', args.voice ?? TTS_VOICE, '-o', aiff, text]);
    // 2. ffmpeg AIFF → OGG/Opus (48k stereo) — pre-encoded opus, no native encoder.
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', aiff,
      '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-f', 'ogg', ogg,
    ]);

    // 3. play into the connection.
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const resource = createAudioResource(ogg, { inputType: StreamType.OggOpus });
    conn.subscribe(player);
    // joinVoice connects self-muted; unmute to actually broadcast, then restore.
    try { (conn as { rejoin: (c: object) => void }).rejoin({ selfMute: false }); } catch { /* ignore */ }
    player.play(resource);

    await entersState(player, AudioPlayerStatus.Playing, 10_000);
    await entersState(player, AudioPlayerStatus.Idle, 120_000);
    player.stop();
    try { (conn as { rejoin: (c: object) => void }).rejoin({ selfMute: true }); } catch { /* ignore */ }

    respond(id, { result: { ok: true, spoke: text, channelName, account: accountId } });
  } catch (err) {
    respond(id, { result: { ok: false, error: (err as Error).message, account: accountId } });
  } finally {
    await cleanup();
  }
}
