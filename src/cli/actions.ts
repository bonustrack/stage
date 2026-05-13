/** CLI action handlers: send/reply/edit/react/download/fetch/notify + helpers. */

import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { errMsg } from '../log.js';
import { DiscordStation } from '../stations/discord.js';
import { TelegramStation } from '../stations/telegram.js';
import { ipcCall } from '../ipc.js';
import {
  agentSelf, appendHistory, lookupEntry, mintId, resolvePlatformId, type HistoryKind,
} from '../history.js';
import { asLine, Line, type Button, type ChatStation, type Line as LineT } from '../stations/index.js';
import { loadMetroEnv } from '../paths.js';
import {
  emit, flagList, flagOne, isJson, need, resolveText, writeJson, type Flags,
} from './util.js';

type AnyChat = ChatStation<Record<string, unknown>>;

export function chatStationOf(line: LineT): AnyChat {
  const s = Line.station(line);
  if (s === 'discord') return new DiscordStation() as unknown as AnyChat;
  if (s === 'telegram') return new TelegramStation() as unknown as AnyChat;
  throw new Error(`no chat station for line "${line}" (try metro://{discord|telegram}/...)`);
}

function parseButtons(f: Flags): Button[][] | undefined {
  const raw = flagOne(f, 'buttons');
  if (raw === undefined) return undefined;
  try { return JSON.parse(raw) as Button[][]; }
  catch (err) { throw new Error(`--buttons must be JSON like '[[{"text":"…","url":"…"}]]': ${errMsg(err)}`); }
}

type RichOpts = { images?: string[]; documents?: string[]; voice?: string; buttons?: Button[][] };
function richOpts(f: Flags): RichOpts {
  const opts: RichOpts = {};
  const images = flagList(f, 'image'); if (images.length) opts.images = images;
  const documents = flagList(f, 'document'); if (documents.length) opts.documents = documents;
  const voice = flagOne(f, 'voice'); if (voice) opts.voice = voice;
  const buttons = parseButtons(f); if (buttons) opts.buttons = buttons;
  return opts;
}

/** Append an outbound action to history.jsonl; pass `to` = the original sender when replying/reacting. */
function logOutbound(
  f: Flags, kind: HistoryKind, line: LineT, text: string | undefined,
  messageId: string, replyTo?: string, _opts?: RichOpts, emoji?: string, to?: LineT,
): string {
  const id = mintId();
  const station = Line.station(line) ?? '?';
  const fromOverride = flagOne(f, 'from');
  const from = fromOverride ? asLine(fromOverride) : agentSelf();
  appendHistory({
    id, ts: new Date().toISOString(), kind, station, line, from, to: to ?? line,
    text, messageId, replyTo, emoji,
  });
  return id;
}

/** When replying/reacting/editing, the recipient is the original message's sender (if we have it). */
const recipientFor = (idOrPlatform: string): LineT | undefined => lookupEntry(idOrPlatform)?.from;

export async function cmdSend(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro send <line> <text> [--image=<path>]… [--document=<path>]… [--voice=<path>] [--buttons=<json>]');
  loadMetroEnv();
  const text = await resolveText(p, 1), line = asLine(p[0]);
  if (Line.isAgent(line)) {
    const resp = await ipcCall({ op: 'notify', line, text });
    if (!resp.ok) throw new Error(resp.error);
    return emit(f, `notified ${line}`, { ok: true, line, id: null, messageId: null });
  }
  const opts = richOpts(f);
  const messageId = await chatStationOf(line).send(line, text, opts);
  const id = logOutbound(f, 'outbound', line, text, messageId, undefined, opts);
  emit(f, `sent ${id} (${messageId}) to ${line}`, { ok: true, line, id, messageId });
}

export async function cmdReply(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro reply <line> <message_id> <text> [--image=… --document=… --voice=… --buttons=…]');
  loadMetroEnv();
  const [to, replyToArg] = p, text = await resolveText(p, 2), line = asLine(to);
  const replyTo = resolvePlatformId(replyToArg);
  const opts = richOpts(f);
  const messageId = await chatStationOf(line).send(line, text, { ...opts, replyTo });
  const id = logOutbound(f, 'outbound', line, text, messageId, replyToArg, opts, undefined, recipientFor(replyToArg));
  emit(f, `replied ${id} (${messageId}) to ${line}#${replyTo}`,
    { ok: true, line, id, replyTo: replyToArg, messageId });
}

export async function cmdEdit(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro edit <line> <message_id> <text> [--buttons=<json>]');
  loadMetroEnv();
  const [to, msgArg] = p, text = await resolveText(p, 2), line = asLine(to);
  const platformId = resolvePlatformId(msgArg);
  const buttons = parseButtons(f);
  await chatStationOf(line).edit(line, platformId, text, buttons ? { buttons } : undefined);
  /** Carry forward the original recipient if we have a row for this message. */
  const original = lookupEntry(msgArg);
  const id = logOutbound(f, 'edit', line, text, platformId, msgArg, undefined, undefined, original?.to);
  emit(f, `edited ${line}#${platformId} (${id})`, { ok: true, line, id, messageId: platformId });
}

export async function cmdReact(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro react <line> <message_id> <emoji>   (empty emoji clears)'); loadMetroEnv();
  const [to, msgArg, emoji = ''] = p, line = asLine(to);
  const platformId = resolvePlatformId(msgArg);
  await chatStationOf(line).react(line, platformId, emoji);
  const id = logOutbound(f, 'react', line, undefined, platformId, undefined, undefined, emoji, recipientFor(msgArg));
  const human = emoji ? `reacted ${emoji} on ${line}#${platformId}` : `cleared reaction on ${line}#${platformId}`;
  emit(f, human, { ok: true, line, id, messageId: platformId, emoji });
}

export async function cmdDownload(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro download <line> <message_id> [--out=<dir>]'); loadMetroEnv();
  const [to, msgArg] = p, line = asLine(to);
  const messageId = resolvePlatformId(msgArg);
  const outDir = typeof f.out === 'string' ? f.out : join(tmpdir(), 'metro-downloads');
  mkdirSync(outDir, { recursive: true });
  /** Telegram has no get-message-by-id REST endpoint — daemon holds the in-memory snapshot. */
  let files: { path: string; mediaType: string }[];
  if (Line.station(line) === 'telegram') {
    const resp = await ipcCall({ op: 'download', line, messageId, outDir });
    if (!resp.ok) throw new Error(resp.error);
    files = 'files' in resp ? resp.files : [];
  } else {
    files = await chatStationOf(line).download(line, messageId, outDir);
  }
  if (isJson(f)) return writeJson({ ok: true, line, files });
  if (!files.length) process.stdout.write(`(no image attachments on ${line}#${messageId})\n`);
  for (const file of files) process.stdout.write(file.path + '\n');
}

export async function cmdFetch(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro fetch <line> [--limit=N]'); loadMetroEnv();
  const line = asLine(p[0]);
  const messages = await chatStationOf(line).fetch(line, Number(flagOne(f, 'limit')) || 20);
  if (isJson(f)) return writeJson({ ok: true, line, messages });
  if (!messages.length) process.stdout.write(`(no messages on ${line})\n`);
  for (const m of messages) process.stdout.write(`${m.timestamp}  ${m.author}: ${m.text}\n`);
}

export async function cmdNotify(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro notify <line> <text> [--from=<line>]'); loadMetroEnv();
  const text = await resolveText(p, 1), line = asLine(p[0]);
  const from = flagOne(f, 'from');
  const resp = await ipcCall({ op: 'notify', line, from, text });
  if (!resp.ok) throw new Error(resp.error);
  emit(f, `notified ${line}`, { ok: true, line });
}
