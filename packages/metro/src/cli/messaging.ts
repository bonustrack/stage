/** Standardized messaging CLI verbs: send/reply/react/unreact/edit/delete/read.
 *  Each routes by <line> (which encodes the station) to that train via forward-call. */

import { readFileSync } from 'node:fs';
import { ipcCall } from '../ipc.js';
import { loadMetroEnv } from '../paths.js';
import { readHistory } from '../history.js';
import { errMsg } from '../log.js';
import {
  isMessagingStation, stationOf, type Attachment, type MessagingEnvelope,
} from '../messaging.js';
import { enforceSendGuard } from './send-guard.js';
import { resolveFrom } from './from.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';

/** Resolve a <text> arg: inline string, `@file`, or `-` (stdin). */
async function resolveText(raw: string): Promise<string> {
  if (raw === '-') {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString('utf8').replace(/\n$/, '');
  }
  if (raw.startsWith('@')) return readFileSync(raw.slice(1), 'utf8');
  return raw;
}

/** Turn --attach values (local paths or URLs) into canonical attachment descriptors. */
function toAttachments(f: Flags): Attachment[] | undefined {
  const raw = f.attach;
  if (raw === undefined || raw === true) return undefined;
  const list = Array.isArray(raw) ? raw : [raw as string];
  if (!list.length) return undefined;
  // url carries both local paths and http(s) urls; trains resolve per platform.
  return list.map(src => ({ kind: 'file', url: src, name: src.split('/').pop() || undefined }));
}

const route = (line: string): string => {
  const station = stationOf(line);
  if (!station) throw exitErr(`not a metro line: '${line}'`, 1);
  if (!isMessagingStation(station)) {
    throw exitErr(`station '${station}' does not speak the messaging contract`, 1);
  }
  return station;
};

async function forward(
  station: string, action: string, env: MessagingEnvelope, f: Flags,
): Promise<void> {
  // Route through the originating session/account when `--from` is given or a
  // sessions.json binding applies. Absent both => account stays unset (unchanged).
  if (env.account === undefined) {
    const from = resolveFrom(env.line, f);
    if (from !== undefined) env.account = from;
  }
  enforceSendGuard(station, action, env);
  let resp;
  try { resp = await ipcCall({ op: 'forward-call', train: station, action, args: env }); }
  catch (err) { throw exitErr(errMsg(err), 4); }
  if (!resp.ok) throw exitErr(resp.error, 3);
  if (!('response' in resp)) throw exitErr('daemon returned malformed forward-call response', 3);
  if (resp.response.error) throw exitErr(`${station}: ${resp.response.error}`, 3);
  const result = resp.response.result ?? null;
  if (isJson(f)) writeJson(result);
  else process.stdout.write(JSON.stringify(result) + '\n');
}

export async function cmdSend(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro send <line> <text> [--reply <msgId>] [--attach <path|url> ...] [--from <session|account>]');
  loadMetroEnv();
  const [line, rawText] = p;
  const station = route(line);
  const env: MessagingEnvelope = { line, text: await resolveText(rawText) };
  const replyTo = flagOne(f, 'reply');
  if (replyTo) env.replyTo = replyTo;
  const attachments = toAttachments(f);
  if (attachments) env.attachments = attachments;
  await forward(station, 'send', env, f);
}

export async function cmdReply(p: string[], f: Flags): Promise<void> {
  need(p, 3, 'metro reply <line> <msgId> <text>');
  loadMetroEnv();
  const [line, messageId, rawText] = p;
  const station = route(line);
  await forward(station, 'reply', { line, replyTo: messageId, text: await resolveText(rawText) }, f);
}

export async function cmdReact(p: string[], f: Flags): Promise<void> {
  need(p, 3, 'metro react <line> <msgId> <emoji>');
  loadMetroEnv();
  const [line, messageId, emoji] = p;
  await forward(route(line), 'react', { line, messageId, emoji }, f);
}

export async function cmdUnreact(p: string[], f: Flags): Promise<void> {
  need(p, 3, 'metro unreact <line> <msgId> <emoji>');
  loadMetroEnv();
  const [line, messageId, emoji] = p;
  await forward(route(line), 'unreact', { line, messageId, emoji }, f);
}

export async function cmdEdit(p: string[], f: Flags): Promise<void> {
  need(p, 3, 'metro edit <line> <msgId> <text>');
  loadMetroEnv();
  const [line, messageId, rawText] = p;
  const station = route(line);
  await forward(station, 'edit', { line, messageId, text: await resolveText(rawText) }, f);
}

export async function cmdDelete(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro delete <line> <msgId>');
  loadMetroEnv();
  const [line, messageId] = p;
  await forward(route(line), 'delete', { line, messageId }, f);
}

/** read: ask the train for live history; on unsupported, fall back to the daemon log. */
export async function cmdRead(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro read <line> [--limit N] [--before <msgId>] [--since <ts>]');
  loadMetroEnv();
  const [line] = p;
  const station = route(line);
  const env: MessagingEnvelope = { line };
  const limit = Number(flagOne(f, 'limit')) || 50;
  env.limit = limit;
  const before = flagOne(f, 'before');
  if (before) env.before = before;
  const since = flagOne(f, 'since');
  if (since) env.since = since;
  try { await forward(station, 'read', env, f); return; }
  catch (err) {
    if (!/unsupported verb/.test(errMsg(err))) throw err;
  }
  const sinceDate = since ? new Date(since) : undefined;
  const entries = readHistory({ line, since: sinceDate, limit });
  emit(f, JSON.stringify({ line, source: 'history', count: entries.length, messages: entries }),
    { line, source: 'history', count: entries.length, messages: entries });
}
