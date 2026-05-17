/** `metro <station> <action> <args>` — generic dispatch via Client.call. */

import { readFileSync } from 'node:fs';
import { Client } from '../client.js';
import { ipcCall, isIpcDaemonRunning } from '../ipc.js';
import { errMsg } from '../log.js';
import { loadMetroEnv } from '../paths.js';
import { emit, exitErr, isJson, type Flags } from './util.js';

function parseArgsBlob(raw: string | undefined): unknown {
  if (!raw || raw === '' ) return {};
  if (raw === '-') return JSON.parse(readFileSync(0, 'utf8'));
  if (raw.startsWith('@')) return JSON.parse(readFileSync(raw.slice(1), 'utf8'));
  return JSON.parse(raw);
}

export async function cmdCall(station: string, action: string, positional: string[], flags: Flags): Promise<void> {
  loadMetroEnv();
  let args: unknown;
  try { args = parseArgsBlob(positional[0]); }
  catch (err) { throw exitErr(`failed to parse args: ${errMsg(err)} (pass JSON, @file, or -)`, 1); }

  /** Prefer the daemon — it holds station state (telegram recent map, claude emit handle). */
  if (isIpcDaemonRunning()) {
    const resp = await ipcCall({ op: 'call', station, action, args });
    if (!resp.ok) throw exitErr(resp.error, 3);
    return emit(flags, fmt(station, action, resp.result), resp.result ?? { ok: true });
  }

  /** Fallback: spawn a one-shot client. Works for stateless calls (REST). */
  const client = new Client();
  try {
    await client.start();
    const result = await client.call(station, action, args);
    return emit(flags, fmt(station, action, result), result ?? { ok: true });
  } finally { await client.stop().catch(() => {}); }
}

function fmt(station: string, action: string, result: unknown): string {
  if (!result || typeof result !== 'object') return `${station}.${action} ok`;
  if ('messageId' in result) return `${station}.${action} → messageId=${(result as { messageId: string }).messageId}`;
  if (isJson({} as Flags)) return JSON.stringify(result);
  return `${station}.${action} ok`;
}
