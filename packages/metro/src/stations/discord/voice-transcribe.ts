// Discord LIVE voice transcription — per-speaker opus → PCM → whisper → inbound envelope.
// On a Ready VoiceConnection we subscribe to each speaker (48kHz stereo opus); prism-media
// (@discordjs/opus) decodes to PCM, ffmpeg → 16kHz mono wav, whisper-cli transcribes, and we
// emit an inbound metro envelope on line metro://discord/<acct>/voice/<channelId>.

import {
  EndBehaviorType, type VoiceConnection, type VoiceReceiver,
} from '@discordjs/voice';
import type { Client } from 'discord.js';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import prism from 'prism-media';
import { emitInbound } from './format.js';
import { mintId } from './wire.js';

const WHISPER_BIN = process.env.WHISPER_CLI ?? 'whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL
  ?? join(process.env.HOME ?? '', '.whisper-models', 'ggml-base.en.bin');
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? 'ffmpeg';
/** Drop utterances shorter than this (raw PCM bytes ≈ 48000*2ch*2byte = 192000 B/s). */
const MIN_PCM_BYTES = 0.5 * 48000 * 2 * 2;

interface Session {
  receiver: VoiceReceiver;
  accountId: string;
  guildId: string;
  channelId: string;
  client: Client;
  active: Set<string>;       // userIds currently being captured (dedup concurrent subs)
  tmp: string;               // temp dir for this session
  enabled: boolean;
  onStart: (userId: string) => void;
}

const sessions = new Map<string, Session>(); // key: guildId

function run(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    p.on('error', reject);
    p.on('close', code => resolve(code ?? 0));
  });
}

/** Decode one speaker's opus stream → raw s16le PCM file. Returns byte count. */
async function captureUtterance(s: Session, userId: string, pcmPath: string): Promise<number> {
  const opus = s.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
  });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  let bytes = 0;
  decoder.on('data', (c: Buffer) => { bytes += c.length; });
  const out = createWriteStream(pcmPath);
  await pipeline(opus, decoder, out);
  return bytes;
}

/** Downsample raw 48k stereo s16le PCM → 16k mono wav for whisper. */
async function pcmToWav(pcmPath: string, wavPath: string): Promise<void> {
  await run(FFMPEG_BIN, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcmPath,
    '-ar', '16000', '-ac', '1', wavPath,
  ]);
}

/** Run whisper-cli on a wav, return trimmed transcript (or ''). */
function transcribe(wavPath: string): Promise<string> {
  const ofBase = wavPath.replace(/\.wav$/, '');
  return new Promise(resolve => {
    const p = spawn(WHISPER_BIN, [
      '-m', WHISPER_MODEL, '-f', wavPath, '-otxt', '-of', ofBase, '-np', '-nt',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('error', () => resolve(''));
    p.on('close', () => {
      // -np prints only the transcript to stdout; fall back to the .txt file.
      let text = out.trim();
      if (!text && existsSync(`${ofBase}.txt`)) {
        try { text = readFileSync(`${ofBase}.txt`, 'utf8').trim(); } catch { /* ignore */ }
      }
      resolve(text);
    });
  });
}

const NOISE = new Set(['', '[blank_audio]', '[silence]', '[ Silence ]', '(silence)', 'you', 'Thank you.']);

async function handleSpeaker(s: Session, userId: string): Promise<void> {
  if (!s.enabled || s.active.has(userId)) return;
  s.active.add(userId);
  const stamp = `${userId}_${Date.now()}`;
  const pcmPath = join(s.tmp, `${stamp}.pcm`);
  const wavPath = join(s.tmp, `${stamp}.wav`);
  try {
    const bytes = await captureUtterance(s, userId, pcmPath);
    if (bytes < MIN_PCM_BYTES) return;
    await pcmToWav(pcmPath, wavPath);
    const text = await transcribe(wavPath);
    if (NOISE.has(text) || text.length < 2) return;
    const member = s.client.guilds.cache.get(s.guildId)?.members.cache.get(userId);
    const name = member?.displayName ?? member?.user.username ?? userId;
    emitInbound(s.accountId, {
      kind: 'inbound', id: mintId(), ts: new Date().toISOString(), station: 'discord',
      line: `metro://discord/${s.accountId}/voice/${s.channelId}`,
      line_name: 'voice', from: `metro://discord/${s.accountId}/user/${userId}`,
      from_name: name, message_id: stamp, text, is_private: false,
      payload: { kind: 'voice_transcript', channel_id: s.channelId, user_id: userId },
    });
  } catch (err) {
    process.stderr.write(`discord voice transcribe error (${userId}): ${(err as Error).message}\n`);
  } finally {
    s.active.delete(userId);
    for (const f of [pcmPath, wavPath, `${wavPath.replace(/\.wav$/, '')}.txt`]) {
      try { rmSync(f, { force: true }); } catch { /* ignore */ }
    }
  }
}

/** Arm live transcription on a Ready connection. Called from joinVoice. */
export function startTranscription(
  guildId: string, channelId: string, accountId: string, client: Client, conn: VoiceConnection,
): void {
  stopTranscription(guildId); // clean any prior session
  const receiver = conn.receiver;
  const s: Session = {
    receiver, accountId, guildId, channelId, client,
    active: new Set(), tmp: mkdtempSync(join(tmpdir(), 'metro-voice-')),
    enabled: true, onStart: () => {},
  };
  s.onStart = (userId: string) => { void handleSpeaker(s, userId); };
  receiver.speaking.on('start', s.onStart);
  sessions.set(guildId, s);
  process.stderr.write(`discord[${accountId}] voice transcription armed on ${channelId}\n`);
}

/** Toggle transcription on/off for a guild's active session without leaving. */
export function setTranscription(guildId: string, on: boolean): boolean {
  const s = sessions.get(guildId);
  if (!s) return false;
  s.enabled = on;
  return true;
}

/** Tear down transcription + temp files. Called from leaveVoice. */
export function stopTranscription(guildId: string): void {
  const s = sessions.get(guildId);
  if (!s) return;
  try { s.receiver.speaking.removeListener('start', s.onStart); } catch { /* ignore */ }
  s.enabled = false;
  try { rmSync(s.tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  sessions.delete(guildId);
}
