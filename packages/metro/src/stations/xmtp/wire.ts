/** XMTP train ↔ daemon wire helpers + universal-id ↔ xmtp-id map. */

import type { TrainErrorInfo } from '../../train-error.js';

export const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');

export const respond = (
  id: string, body: { result?: unknown; error?: string; errorInfo?: TrainErrorInfo },
): void => void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');

export const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;

export const SELF_URI = process.env.METRO_SELF_URI ?? '';

// Every emitted event carries a universal `msg_*` id AND the raw xmtp message_id;
// we remember that mapping so an agent can pass EITHER id. Bounded LRU-ish: the
// insertion-ordered Map evicts the oldest entry once past the cap.
const UID_MAP_MAX = 5000;
const uidToXmtp = new Map<string, string>();

/** #9: daemon-side inbox→eth cache (mirrors app inboxEthCache). */
export const inboxEthCache = new Map<string, string>();

export function rememberUid(uid: string | undefined, xmtpId: string | undefined): void {
  if (!uid || !xmtpId || !uid.startsWith('msg_')) return;
  uidToXmtp.set(uid, xmtpId);
  if (uidToXmtp.size > UID_MAP_MAX) {
    const oldest = uidToXmtp.keys().next().value;
    if (oldest !== undefined) uidToXmtp.delete(oldest);
  }
}

/** Resolve a possibly-universal (`msg_*`) id to a raw xmtp message id. A raw xmtp
 *  id passes through; an unknown `msg_*` errors clearly. */
export function resolveMsgId(rawId: string): string {
  if (!rawId.startsWith('msg_')) return rawId;
  const mapped = uidToXmtp.get(rawId);
  if (mapped) return mapped;
  throw new Error(`could not resolve universal id ${rawId} to an xmtp message id `
    + '(not seen by this train; pass the raw xmtp message_id)');
}
