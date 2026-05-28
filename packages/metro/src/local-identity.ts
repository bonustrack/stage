/** Resolve the local user identity for Claude Code / Codex hosts — used to mint */
/** `metro://claude/<orgId>/<sessionId>` and `metro://codex/<accountId>/<threadId>` URIs. */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { STATE_DIR } from './paths.js';

const TTL_MS = 5_000;
type Cache = { id: string; at: number } | null;

/** Memoize an account-id resolver for TTL_MS to avoid hammering `claude auth` / re-reading auth.json. */
function memo(loader: () => string): () => string {
  let cache: Cache = null;
  return () => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.id;
    const id = loader();
    cache = { id, at: Date.now() };
    return id;
  };
}

const claudeAccountId = memo(() => {
  let raw: string;
  try { raw = execFileSync('claude', ['auth', 'status', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { throw new Error(`metro: failed to run 'claude auth status --json' — is Claude Code installed? (${(e as Error).message})`); }
  let p: { loggedIn?: boolean; orgId?: string };
  try { p = JSON.parse(raw); } catch { throw new Error(`metro: 'claude auth status --json' returned non-JSON: ${raw.slice(0, 200)}`); }
  if (!p.loggedIn || !p.orgId) throw new Error('metro: Claude Code is not logged in — run \'claude auth login\'');
  return p.orgId;
});

const codexAccountId = memo(() => {
  const path = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { throw new Error(`metro: failed to read ${path} — is Codex logged in? (${(e as Error).message})`); }
  let p: { tokens?: { account_id?: string }; auth_mode?: string };
  try { p = JSON.parse(raw); } catch { throw new Error(`metro: ${path} is not valid JSON`); }
  const id = p.tokens?.account_id;
  if (!id) throw new Error(`metro: no Codex account_id in ${path} (auth_mode=${p.auth_mode ?? 'unknown'}) — sign in with 'codex login' (ChatGPT mode required)`);
  return id;
});

export const claudeUserId = (): string => process.env.METRO_USER_ID || claudeAccountId();
export const codexUserId = (): string => process.env.METRO_USER_ID || codexAccountId();

/** Non-throwing Codex account-id resolver. Returns null instead of throwing */
/** when Codex isn't logged in / auth.json is absent — lets a neutral daemon */
/** gate the Codex bridge without crashing if Codex is unavailable. */
export const codexUserIdOrNull = (): string | null => {
  if (process.env.METRO_USER_ID) return process.env.METRO_USER_ID;
  try { return codexAccountId(); } catch { return null; }
};
export const claudeSessionId = (): string | null =>
  process.env.METRO_USER_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || null;

const CODEX_SESSION_FILE = join(STATE_DIR, 'codex-session-id');

export function codexSessionId(): string | null {
  if (process.env.METRO_USER_SESSION_ID) return process.env.METRO_USER_SESSION_ID;
  try { return readFileSync(CODEX_SESSION_FILE, 'utf8').trim() || null; }
  catch { return null; }
}

export function setCodexSessionId(threadId: string | null): void {
  try {
    mkdirSync(dirname(CODEX_SESSION_FILE), { recursive: true });
    writeFileSync(CODEX_SESSION_FILE, threadId ?? '');
  } catch { /* CLI just won't have a session segment */ }
}
