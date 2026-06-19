/**
 * @file Wires the single app-wide XMTP message stream into TanStack Query: on a streamed `group_updated` event it invalidates that conv's convMeta key so the topnav / group screen pick up renames/images/descriptions without a manual reload (plain messages are untouched).
 */

import { subscribeAllMessages } from '../../lib/xmtp';
import type { StreamMsg } from '../../lib/xmtp.types';
import { invalidateConvMeta } from './queries';

/** Standard XMTP content-type id for a group-metadata update. Matched as a substring so we don't depend on the exact version suffix. */
const GROUP_UPDATED = 'group_updated';

/** Whether Group Updated. */
function isGroupUpdated(m: StreamMsg): boolean {
  const id = (m.msg as unknown as { contentTypeId?: string }).contentTypeId;
  return typeof id === 'string' && id.includes(GROUP_UPDATED);
}

let started = false;
/** Subscribe the convMeta-invalidation listener to the global stream. Idempotent + lazy: call from app boot or the first screen that cares. Returns a no-op if already wired (the underlying stream is a single shared fan-out). */
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeAllMessages((m: StreamMsg) => {
    if (m.convId && isGroupUpdated(m)) invalidateConvMeta(m.convId);
  });
}
