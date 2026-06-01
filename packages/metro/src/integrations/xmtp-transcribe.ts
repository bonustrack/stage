/** Whisper transcription of inbound voice/audio attachments → transcript event. */

import { mintId, SELF_URI } from './xmtp-wire.js';
import { emitInbound } from './xmtp-emit.js';

const WHISPER_BIN = process.env.METRO_WHISPER_BIN ?? 'whisper-cli';
const WHISPER_MODEL = process.env.METRO_WHISPER_MODEL ?? `${process.env.HOME}/.cache/whisper-cpp/ggml-base.bin`;
const FFMPEG_BIN = process.env.METRO_FFMPEG_BIN ?? 'ffmpeg';

export async function transcribeAndEmit(
  audio: Uint8Array, line: string, accountId: string, sourceMsgId: string,
): Promise<void> {
  const { existsSync: ex, readFileSync: rf, writeFileSync: wf, unlinkSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const { spawn } = await import('node:child_process');
  if (!ex(WHISPER_MODEL)) return;
  const dir = mkdtempSync(j(tmpdir(), 'xmtp-tx-'));
  const inFile = j(dir, 'in.m4a'); const wav = j(dir, 'in.wav'); const out = j(dir, 'in');
  const run = (bin: string, args: string[]): Promise<void> => new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: 'ignore' });
    p.on('error', rej); p.on('exit', c => c === 0 ? res() : rej(new Error(`${bin} ${c}`)));
  });
  try {
    wf(inFile, audio);
    await run(FFMPEG_BIN, ['-y', '-i', inFile, '-ar', '16000', '-ac', '1', wav]);
    await run(WHISPER_BIN, ['-m', WHISPER_MODEL, '-f', wav, '--output-txt', '-of', out]);
    const text = rf(`${out}.txt`, 'utf8').trim();
    if (!text) return;
    emitInbound(accountId, {
      id: mintId(), ts: new Date().toISOString(), station: 'xmtp', line, from: SELF_URI,
      text: `🎙️ ${text}`,
      payload: { contentType: 'transcript', transcribeFor: sourceMsgId, transcript: text },
    });
  } catch (err) { process.stderr.write(`xmtp transcribe failed: ${(err as Error).message}\n`); }
  finally { for (const f of [inFile, wav, `${out}.txt`]) { try { unlinkSync(f); } catch { /* ignore */ } } }
}
