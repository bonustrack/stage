/** Local whisper.cpp audio transcription. Opt-in: requires whisper-cli + ggml model on disk. */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { errMsg, log } from '../log.js';

const WHISPER_BIN = process.env.METRO_WHISPER_BIN ?? 'whisper-cli';
const WHISPER_MODEL = process.env.METRO_WHISPER_MODEL
  ?? join(homedir(), '.cache', 'whisper-cpp', 'ggml-base.bin');
const FFMPEG_BIN = process.env.METRO_FFMPEG_BIN ?? 'ffmpeg';

function runCmd(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`))));
  });
}

/** Transcribe a local audio file to text. Returns null on any failure (incl. missing tooling). */
export async function transcribeAudio(filePath: string): Promise<string | null> {
  if (!existsSync(WHISPER_MODEL) || !existsSync(filePath)) return null;
  const base = basename(filePath, extname(filePath));
  const wav = join(tmpdir(), `metro-tx-${base}.wav`);
  const outPrefix = join(tmpdir(), `metro-tx-${base}`);
  try {
    await runCmd(FFMPEG_BIN, ['-y', '-i', filePath, '-ar', '16000', '-ac', '1', wav]);
    await runCmd(WHISPER_BIN, ['-m', WHISPER_MODEL, '-f', wav, '--output-txt', '-of', outPrefix]);
    const text = readFileSync(`${outPrefix}.txt`, 'utf8').trim();
    return text || null;
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'messenger transcribe failed');
    return null;
  } finally {
    for (const f of [wav, `${outPrefix}.txt`]) { try { unlinkSync(f); } catch { /* ignore */ } }
  }
}
