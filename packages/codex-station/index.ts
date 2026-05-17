/** Codex station — identifies the local Codex user; `notify` re-emits cross-user messages. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { asLine, Line, mintId, type Envelope, type Station } from '@stage-labs/metro';

let emit: ((e: Envelope) => void) | null = null;
let cache: { id: string; at: number } | null = null;
const TTL_MS = 5_000;

const authPath = (): string => join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
const stateDir = (): string => process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
const sessionFile = (): string => join(stateDir(), 'stations', 'codex', 'session-id');

export function codexAccountId(): string {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.id;
  const path = authPath();
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { throw new Error(`metro: failed to read ${path} (${(e as Error).message})`); }
  let parsed: { tokens?: { account_id?: string }; auth_mode?: string };
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`metro: ${path} is not valid JSON`); }
  const id = parsed.tokens?.account_id;
  if (!id) throw new Error(`metro: no Codex account_id in ${path} — run 'codex login'`);
  cache = { id, at: Date.now() };
  return id;
}

export function codexUserId(): string { return process.env.METRO_USER_ID || codexAccountId(); }

export function codexSessionId(): string | null {
  if (process.env.METRO_USER_SESSION_ID) return process.env.METRO_USER_SESSION_ID;
  try { return readFileSync(sessionFile(), 'utf8').trim() || null; } catch { return null; }
}

export function setCodexSessionId(threadId: string | null): void {
  try {
    mkdirSync(dirname(sessionFile()), { recursive: true });
    writeFileSync(sessionFile(), threadId ?? '');
  } catch { /* CLI just won't have a session segment */ }
}

const station: Station = {
  name: 'codex',

  configured: () => !!(process.env.METRO_CODEX_RC || (process.env.CODEX_HOME && existsSync(authPath()))),

  async start(e) { emit = e; },
  async stop() { emit = null; },

  actions: {
    async notify({ line, text, from }: { line: string; text: string; from?: string }) {
      if (!emit) throw new Error('codex station not started');
      const station_ = Line.station(line as Line) ?? 'codex';
      const fromLine = from ? asLine(from) : Line.user('codex', codexUserId());
      emit({
        id: mintId(), ts: new Date().toISOString(), kind: 'message',
        station: station_, line: line as Line, from: fromLine, to: line as Line, text,
      });
      return { ok: true };
    },
    async whoami() {
      try { return { ok: true, accountId: codexAccountId(), userId: codexUserId(), sessionId: codexSessionId() }; }
      catch (err) { return { ok: false, error: (err as Error).message }; }
    },
  },
};

export default station;
