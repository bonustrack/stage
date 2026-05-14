/** Resolve the Claude Code user identity (account id + session id). */

import { execFileSync } from 'node:child_process';

/** Short TTL so account switches via `claude auth login` propagate to the daemon within seconds. */
const TTL_MS = 5_000;
let cache: { id: string; at: number } | null = null;

/** Stable per-Anthropic-account UUID. Same across devices for the same login. */
export function claudeAccountId(): string {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.id;
  let raw: string;
  try {
    raw = execFileSync('claude', ['auth', 'status', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`metro: failed to run 'claude auth status --json' — is Claude Code installed and on PATH? (${(e as Error).message})`);
  }
  let parsed: { loggedIn?: boolean; orgId?: string };
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`metro: 'claude auth status --json' returned non-JSON: ${raw.slice(0, 200)}`); }
  if (!parsed.loggedIn || !parsed.orgId) {
    throw new Error('metro: Claude Code is not logged in — run \'claude auth login\'');
  }
  cache = { id: parsed.orgId, at: Date.now() };
  return parsed.orgId;
}

export function tryClaudeAccountId(): string | null {
  try { return claudeAccountId(); } catch { return null; }
}

/** User-id for the line URI: `METRO_USER_ID` override, else the account id. */
export function claudeUserId(): string {
  return process.env.METRO_USER_ID || claudeAccountId();
}

/** Session: `CLAUDE_CODE_SESSION_ID` (stable across `--resume`). Override: `METRO_USER_SESSION_ID`. */
export function claudeSessionId(): string | null {
  return process.env.METRO_USER_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || null;
}
