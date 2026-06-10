/** `--from <session|account>` OUTBOUND ROUTING — resolve the originating */
/** session/account for a send so the daemon routes it through the right xmtp */
/** account (`accountForCall` already honors `env.account`; this just fills it). */
/** ADDITIVE + behavior-preserving: returns undefined unless EITHER an explicit */
/** `--from` is given OR a sessions.json binding applies to the active session. */
/** With no flag and no sessions.json (today's reality) it always returns */
/** undefined, so `env.account` stays unset and routing is byte-for-byte unchanged. */

import { accountForSession, activeSessionId, loadSessions, type SessionStation } from '../sessions.js';
import { stationOf } from '../messaging.js';
import { flagOne, type Flags } from './util.js';

/** Map a messaging station to its session-binding station. Only xmtp is */
/** multi-account today; discord/telegram bind 1:1, so `from` is a no-op there. */
function bindingStation(station: string): SessionStation | null {
  return station === 'xmtp' ? 'xmtp' : null;
}

/** Resolve a `--from` name to an account id. A name that matches a session id in */
/** sessions.json resolves via its binding; otherwise it is treated as a LITERAL */
/** account id and passed through verbatim (the daemon validates it). */
function resolveName(name: string, st: SessionStation): string {
  return name in loadSessions() ? (accountForSession(name, st) ?? name) : name;
}

/** Resolve the outbound account id for a verb, or undefined to keep today's */
/** behavior. Precedence: explicit `--from` > active-session sessions.json binding. */
export function resolveFrom(line: string, f: Flags): string | undefined {
  const station = stationOf(line);
  const st = station ? bindingStation(station) : null;
  const explicit = flagOne(f, 'from');
  if (explicit) {
    // Without a binding station the flag is inert (literal pass-through is xmtp-only).
    return st ? resolveName(explicit, st) : explicit;
  }
  if (!st) return undefined;
  const sid = activeSessionId();
  return sid ? (accountForSession(sid, st) ?? undefined) : undefined;
}
