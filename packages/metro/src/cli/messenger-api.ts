/** Messenger endpoints: send + react + register, plus Expo push delivery. Upload/serve in messenger-uploads.ts. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, join } from 'node:path';
import { mintId, readHistory, userSelf, type HistoryEntry } from '../history.js';
import { Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { handleMessengerFile, handleMessengerUpload } from './messenger-uploads.js';
import { transcribeAudio } from './messenger-transcribe.js';

const UPLOADS_DIR = join(STATE_DIR, 'messenger-uploads');

const MESSENGER_LINE = 'metro://messenger/owner' as Line;
const MESSENGER_USER = 'metro://messenger/user/owner' as Line;
const PUSH_TOKENS_FILE = join(STATE_DIR, 'push-tokens.json');

function readPushTokens(): string[] {
  try { return existsSync(PUSH_TOKENS_FILE) ? JSON.parse(readFileSync(PUSH_TOKENS_FILE, 'utf8')) as string[] : []; }
  catch { return []; }
}

function writePushTokens(tokens: string[]): void {
  writeFileSync(PUSH_TOKENS_FILE, JSON.stringify([...new Set(tokens)]));
}

async function pushExpo(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map(to => ({ to, title, body, sound: 'default' }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) { log.warn({ err: errMsg(err) }, 'expo push failed'); }
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T | { __error: string }> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; }
  catch (err) { return { __error: `bad JSON body: ${errMsg(err)}` }; }
}

type Send = (res: ServerResponse, req: IncomingMessage, status: number, body: unknown) => void;
type Emit = (entry: HistoryEntry) => void;

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

/** Route all /api/messenger/* paths. Returns true if handled. */
export function routeMessenger(
  req: IncomingMessage, res: ServerResponse, path: string, emit: Emit | undefined, send: Send,
): boolean {
  const guard = (
    p: () => Promise<void> | void, label: string, methodOk: boolean = true,
  ): boolean => {
    if (!methodOk) { send(res, req, 405, { error: 'method not allowed' }); return true; }
    Promise.resolve(p()).catch(err => {
      log.warn({ err: errMsg(err) }, `monitor: ${label} error`);
      try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
    });
    return true;
  };
  if (path === '/api/messenger/send') {
    if (!emit) { send(res, req, 500, { error: 'emit not wired' }); return true; }
    return guard(() => handleMessengerSend(req, res, emit, send), 'messenger-send', req.method === 'POST');
  }
  if (path === '/api/messenger/react') {
    if (!emit) { send(res, req, 500, { error: 'emit not wired' }); return true; }
    return guard(() => handleMessengerReact(req, res, emit, send), 'messenger-react', req.method === 'POST');
  }
  if (path === '/api/messenger/register') {
    return guard(() => handleMessengerRegister(req, res, send), 'messenger-register', req.method === 'POST');
  }
  if (path === '/api/messenger/upload') {
    return guard(() => handleMessengerUpload(req, res, send), 'messenger-upload', req.method === 'POST');
  }
  const fileMatch = path.match(/^\/api\/messenger\/files\/([^/]+)$/);
  if (fileMatch) {
    if (req.method !== 'GET') { send(res, req, 405, { error: 'method not allowed' }); return true; }
    handleMessengerFile(req, res, decodeURIComponent(fileMatch[1]), send);
    return true;
  }
  return false;
}

export async function handleMessengerSend(
  req: IncomingMessage, res: ServerResponse, emit: Emit, send: Send,
): Promise<void> {
  const body = await readJsonBody<{
    text?: string; as?: string; attachments?: Attachment[]; replyTo?: string;
    question?: {
      header?: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
    };
  }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const text = (body.text ?? '').trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const question = body.question && Array.isArray(body.question.options) && body.question.options.length > 0
    ? body.question : undefined;
  if (!text && attachments.length === 0 && !question) {
    return send(res, req, 400, { error: 'text, attachments, or question required' });
  }
  const fromAgent = body.as === 'agent';
  const agent = userSelf();
  const replyTo = typeof body.replyTo === 'string' && body.replyTo ? body.replyTo : undefined;
  /** Merge attachments + question into a single payload object so the client can read
   *  both off `payload.attachments` and `payload.question`. */
  const payload = (attachments.length > 0 || question)
    ? { ...(attachments.length > 0 ? { attachments } : {}), ...(question ? { question } : {}) }
    : undefined;
  const entry: HistoryEntry = {
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'messenger',
    line: MESSENGER_LINE,
    from: fromAgent ? agent : MESSENGER_USER,
    to: fromAgent ? MESSENGER_USER : agent,
    text: text || undefined,
    ...(replyTo ? { replyTo } : {}),
    ...(payload ? { payload } : {}),
  };
  emit(entry);
  /** Agent → user: push to registered tokens. User → agent: their own message; skip. */
  if (fromAgent) {
    const a = attachments[0];
    const kindLabel = a?.kind === 'image' ? '📷 Photo'
      : a?.kind === 'audio' ? '🎤 Voice message'
        : a?.kind === 'video' ? '🎬 Video'
          : a ? `📎 ${a.name ?? 'File'}` : '';
    const questionLabel = question ? `❓ ${question.header ?? 'Choose an option'}` : '';
    const summary = text || kindLabel || questionLabel || '(empty)';
    void pushExpo(readPushTokens(), 'Metro', summary.slice(0, 200));
  }
  /** Fire-and-forget: transcribe any audio attachments and emit a follow-up event. */
  for (const att of attachments) {
    if (att.kind !== 'audio') continue;
    const filename = basename(att.url);
    void transcribeAudio(join(UPLOADS_DIR, filename)).then(transcript => {
      if (!transcript) return;
      emit({
        id: mintId(), ts: new Date().toISOString(),
        station: 'messenger', line: MESSENGER_LINE,
        from: entry.from, to: entry.to,
        payload: { transcribeFor: entry.id, transcript },
      });
    });
  }
  send(res, req, 200, { id: entry.id, line: entry.line });
}

/** Toggle a reaction; if already-active, emit `{removed: true}` so the client folds pairs. */
export async function handleMessengerReact(
  req: IncomingMessage, res: ServerResponse, emit: Emit, send: Send,
): Promise<void> {
  const body = await readJsonBody<{ messageId?: string; emoji?: string; as?: string }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const messageId = (body.messageId ?? '').trim();
  const emoji = (body.emoji ?? '').trim();
  if (!messageId || !emoji) return send(res, req, 400, { error: 'messageId + emoji required' });
  const fromAgent = body.as === 'agent';
  const agent = userSelf();
  const sender = fromAgent ? agent : MESSENGER_USER;
  /** Scan recent messenger history for an already-active reaction from this sender. */
  /** readHistory returns newest-first; break on first match so we get the latest event's state. */
  const recent = readHistory({ limit: 500, station: 'messenger' });
  let active = false;
  for (const e of recent) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || p.reactTo !== messageId || p.emoji !== emoji || e.from !== sender) continue;
    active = !p.removed;
    break;
  }
  const entry: HistoryEntry = {
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'messenger',
    line: MESSENGER_LINE,
    from: sender,
    to: fromAgent ? MESSENGER_USER : agent,
    payload: { reactTo: messageId, emoji, ...(active ? { removed: true } : {}) },
  };
  emit(entry);
  send(res, req, 200, { id: entry.id, removed: active });
}

export async function handleMessengerRegister(
  req: IncomingMessage, res: ServerResponse, send: Send,
): Promise<void> {
  const body = await readJsonBody<{ pushToken?: string }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const token = (body.pushToken ?? '').trim();
  if (!token) return send(res, req, 400, { error: 'pushToken is required' });
  const tokens = readPushTokens();
  if (!tokens.includes(token)) writePushTokens([...tokens, token]);
  send(res, req, 200, { ok: true, count: tokens.includes(token) ? tokens.length : tokens.length + 1 });
}
