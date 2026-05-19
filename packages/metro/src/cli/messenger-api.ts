/** Messenger endpoints: send + register, plus Expo push delivery. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { mintId, userSelf, type HistoryEntry } from '../history.js';
import { Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

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

export async function handleMessengerSend(
  req: IncomingMessage, res: ServerResponse, emit: Emit, send: Send,
): Promise<void> {
  const body = await readJsonBody<{ text?: string; as?: string }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const text = (body.text ?? '').trim();
  if (!text) return send(res, req, 400, { error: 'text is required' });
  const fromAgent = body.as === 'agent';
  const agent = userSelf();
  const entry: HistoryEntry = {
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'messenger',
    line: MESSENGER_LINE,
    from: fromAgent ? agent : MESSENGER_USER,
    to: fromAgent ? MESSENGER_USER : agent,
    text,
  };
  emit(entry);
  /** Agent → user: push to registered tokens. User → agent: their own message; skip. */
  if (fromAgent) void pushExpo(readPushTokens(), 'Metro', text.slice(0, 200));
  send(res, req, 200, { id: entry.id, line: entry.line });
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
