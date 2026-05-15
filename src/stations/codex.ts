/** Resolve the Codex user identity (account id + session id). */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { STATE_DIR } from '../paths.js';

/** Short TTL so account switches via `codex login` propagate to the daemon within seconds. */
const TTL_MS = 5_000;
let cache: { id: string; at: number } | null = null;

function authPath(): string {
  return join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
}

export function codexAccountId(): string {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.id;
  const path = authPath();
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { throw new Error(`metro: failed to read ${path} — is Codex logged in? (${(e as Error).message})`); }
  let parsed: { tokens?: { account_id?: string }; auth_mode?: string };
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`metro: ${path} is not valid JSON`); }
  const id = parsed.tokens?.account_id;
  if (!id) {
    throw new Error(`metro: no Codex account_id in ${path} (auth_mode=${parsed.auth_mode ?? 'unknown'}) — sign in with 'codex login' (ChatGPT mode required)`);
  }
  cache = { id, at: Date.now() };
  return id;
}

export function tryCodexAccountId(): string | null {
  try { return codexAccountId(); } catch { return null; }
}

/** User-id for the line URI: `METRO_USER_ID` override, else the account id. */
export function codexUserId(): string {
  return process.env.METRO_USER_ID || codexAccountId();
}

const SESSION_FILE = join(STATE_DIR, 'stations', 'codex', 'session-id');

/** Session: codex-rc thread id (daemon persists; CLIs read state file). Override: `METRO_USER_SESSION_ID`. */
export function codexSessionId(): string | null {
  if (process.env.METRO_USER_SESSION_ID) return process.env.METRO_USER_SESSION_ID;
  try { return readFileSync(SESSION_FILE, 'utf8').trim() || null; }
  catch { return null; }
}

/** Daemon-side: persist the rc thread id so CLI processes can read it. Best-effort. */
export function setCodexSessionId(threadId: string | null): void {
  try {
    mkdirSync(dirname(SESSION_FILE), { recursive: true });
    writeFileSync(SESSION_FILE, threadId ?? '');
  } catch { /* CLI just won't have a session segment */ }
}
