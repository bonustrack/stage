/** `metro call <train> <action> [args]` + `metro trains list`. */
/** Generic call dispatch — the daemon forwards to the train's stdin and awaits a response. */

import { readFileSync } from 'node:fs';
import { ipcCall } from '../ipc.js';
import { loadMetroEnv } from '../paths.js';
import { isJson, need, writeJson, type Flags } from './util.js';

async function readArgs(raw: string | undefined): Promise<unknown> {
  if (raw === undefined) return {};
  if (raw === '-') {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    const s = Buffer.concat(chunks).toString('utf8').trim();
    return s ? JSON.parse(s) : {};
  }
  if (raw.startsWith('@')) return JSON.parse(readFileSync(raw.slice(1), 'utf8'));
  /** Bare string allowed (handed to the train as-is). */
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function cmdCall(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro call <train> <action> [args-json | @file | -]');
  loadMetroEnv();
  const [train, action, rawArgs] = p;
  const args = await readArgs(rawArgs);
  const resp = await ipcCall({ op: 'forward-call', train, action, args });
  if (!resp.ok) throw new Error(resp.error);
  if (!('response' in resp)) throw new Error('daemon returned malformed forward-call response');
  if (resp.response.error) throw new Error(`train '${train}': ${resp.response.error}`);
  if (isJson(f)) writeJson(resp.response.result ?? null);
  else process.stdout.write(JSON.stringify(resp.response.result ?? null) + '\n');
}

export async function cmdTrains(p: string[], f: Flags): Promise<void> {
  const sub = p[0] ?? 'list';
  if (sub !== 'list') throw new Error(`metro trains <list>   (got '${sub}')`);
  loadMetroEnv();
  const resp = await ipcCall({ op: 'trains-list' });
  if (!resp.ok) throw new Error(resp.error);
  if (!('trains' in resp)) throw new Error('daemon returned malformed trains-list response');
  if (isJson(f)) return writeJson({ trains: resp.trains });
  const rows = resp.trains;
  if (!rows.length) {
    process.stdout.write('metro trains\n\n  (no trains in ~/.metro/trains/)\n');
    return;
  }
  process.stdout.write('metro trains\n\n');
  for (const t of rows) {
    const mark = t.running ? '●' : '○';
    const pid = t.pid ? ` pid ${t.pid}` : '';
    const started = t.startedAt ? ` since ${t.startedAt.slice(11, 19)}` : '';
    const fails = t.failCount ? ` · ${t.failCount} fail${t.failCount === 1 ? '' : 's'}` : '';
    process.stdout.write(`  ${mark} ${t.name.padEnd(16)}${pid}${started}${fails}\n        ${t.path}\n`);
  }
  process.stdout.write('\n');
}
