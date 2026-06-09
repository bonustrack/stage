/** `metro whoami` — read-only identity report: resolved owner URI, account bound */
/** per station, and the `--strict` tail command for this identity's feed. */
/** Layered + behavior-preserving: if `~/.metro/sessions.json` is present AND a */
/** session id is resolvable, the report reflects the session binding (owner */
/** `metro://session/<id>`); otherwise it reports TODAY's reality — the env / */
/** account-derived participant identity (`userSelf()`), exactly as now. */

import { userSelf, selfLine } from '../history.js';
import {
  accountForSession, listSessions, sessionOwner, sessionsPresent,
  SESSION_STATIONS, type SessionStation,
} from '../sessions.js';
import { type Line } from '../lines.js';
import { loadMetroEnv } from '../paths.js';
import { claudeSessionId, codexSessionId } from '../local-identity.js';
import { emit, type Flags } from './util.js';

/** Resolve the active session id for binding lookup: CLI session id (claude/codex) */
/** or an explicit METRO_SESSION override. Null when none is known. */
function activeSessionId(): string | null {
  if (process.env.METRO_SESSION) return process.env.METRO_SESSION;
  if (process.env.CLAUDECODE) return claudeSessionId();
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) return codexSessionId();
  return null;
}

interface WhoAmI {
  /** 'session' when a sessions.json binding applies, else 'env' (today's reality). */
  source: 'session' | 'env';
  owner: Line;
  /** Set only when source==='session'. */
  session: string | null;
  /** The participant/line identity as resolved today (always reported). */
  self: Line;
  selfLine: Line | null;
  /** account id bound per station (only populated under a session binding). */
  accounts: Partial<Record<SessionStation, string>>;
  /** Suggested strict tail command for this identity's feed. */
  tail: string;
}

export function resolveWhoAmI(): WhoAmI {
  const self = userSelf();
  const line = selfLine();
  const sid = activeSessionId();
  const binding = sid ? listSessions().find(s => s.id === sid)?.binding : undefined;
  const useSession = sessionsPresent() && sid !== null && !!binding && Object.keys(binding).length > 0;

  if (useSession && sid) {
    const accounts: Partial<Record<SessionStation, string>> = {};
    for (const st of SESSION_STATIONS) {
      const acct = accountForSession(sid, st);
      if (acct) accounts[st] = acct;
    }
    const owner = sessionOwner(sid);
    return {
      source: 'session', owner, session: sid, self, selfLine: line, accounts,
      tail: `metro tail --as ${owner} --strict --follow`,
    };
  }

  /** Fallback = today's behavior: env/account-derived participant identity. */
  return {
    source: 'env', owner: self, session: null, self, selfLine: line, accounts: {},
    tail: self === 'metro://user'
      ? 'metro tail --strict --follow'
      : `metro tail --as ${self} --strict --follow`,
  };
}

export async function cmdWhoami(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const who = resolveWhoAmI();
  if (f.json === true) { emit(f, '', who); return; }

  const lines = [
    'metro whoami',
    '',
    `  source   ${who.source === 'session' ? 'sessions.json binding' : 'env / account-derived (no sessions.json)'}`,
    `  owner    ${who.owner}`,
  ];
  if (who.session) lines.push(`  session  ${who.session}`);
  lines.push(`  self     ${who.self}`);
  if (who.selfLine) lines.push(`  line     ${who.selfLine}`);
  if (who.source === 'session') {
    lines.push('', '  accounts');
    for (const st of SESSION_STATIONS) {
      lines.push(`    ${st.padEnd(9)} ${who.accounts[st] ?? '(fallback to per-account owner)'}`);
    }
  }
  lines.push('', '  tail', `    ${who.tail}`, '');
  process.stdout.write(lines.join('\n') + '\n');
}

export async function cmdSessions(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const rows = listSessions();
  if (f.json === true) { emit(f, '', { sessions: rows }); return; }
  if (!rows.length) {
    process.stdout.write('metro session list\n\n  (no sessions.json — identity falls back to env / per-account owner)\n\n');
    return;
  }
  process.stdout.write('metro session list\n\n');
  for (const r of rows) {
    const parts = SESSION_STATIONS
      .map(st => (r.binding[st] ? `${st}=${r.binding[st]}` : null))
      .filter(Boolean);
    if (r.binding.default) parts.push(`default=${r.binding.default}`);
    process.stdout.write(`  ${r.owner}\n    ${parts.join('  ') || '(empty binding)'}\n`);
  }
  process.stdout.write('\n');
}
