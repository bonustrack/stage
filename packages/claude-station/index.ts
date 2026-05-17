/** Claude station — identifies the local Claude Code user; `notify` re-emits cross-user messages. */

import { execFileSync } from 'node:child_process';
import { asLine, Line, mintId, type Envelope, type Station } from '@stage-labs/metro';

let emit: ((e: Envelope) => void) | null = null;
let cache: { id: string; at: number } | null = null;
const TTL_MS = 5_000;

export function claudeAccountId(): string {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.id;
  let raw: string;
  try {
    raw = execFileSync('claude', ['auth', 'status', '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`metro: failed to run 'claude auth status --json' (${(e as Error).message})`);
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

export function claudeUserId(): string { return process.env.METRO_USER_ID || claudeAccountId(); }

const station: Station = {
  name: 'claude',

  configured: () => !!process.env.CLAUDECODE,

  async start(e) { emit = e; },
  async stop() { emit = null; },

  actions: {
    /** Re-emit an inbound on the daemon's stream — used for cross-user messaging. */
    async notify({ line, text, from }: { line: string; text: string; from?: string }) {
      if (!emit) throw new Error('claude station not started');
      const station_ = Line.station(line as Line) ?? 'claude';
      const fromLine = from ? asLine(from) : Line.user('claude', claudeUserId());
      emit({
        id: mintId(), ts: new Date().toISOString(), kind: 'message',
        station: station_, line: line as Line, from: fromLine, to: line as Line, text,
      });
      return { ok: true };
    },
    /** Identity introspection — returns the current Anthropic org id. */
    async whoami() {
      try { return { ok: true, accountId: claudeAccountId(), userId: claudeUserId() }; }
      catch (err) { return { ok: false, error: (err as Error).message }; }
    },
  },
};

export default station;
