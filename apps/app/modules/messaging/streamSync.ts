/** Wire the single app-wide XMTP message stream into TanStack Query.
 *
 *  The stream is push, not fetch, so it stays OUTSIDE Query - but it FEEDS Query:
 *  when a group-metadata-change event (`group_updated`) streams in for a conv, we
 *  invalidate that conv's convMeta key so the topnav / group screen pick up the
 *  rename / new image / description without a manual reload. Plain messages do
 *  NOT touch convMeta (metadata didn't change); the channels-list bookkeeping
 *  continues through the existing channelsCache write-through, mirrored to Query
 *  by channelsQuery's cache bridge.
 *
 *  This is additive: if the content type doesn't match, nothing happens, so the
 *  established message/preview/unread path is unchanged. */

import { subscribeAllMessages } from '../../lib/xmtp';
import type { StreamMsg } from '../../lib/xmtp.types';
import { invalidateConvMeta } from './queries';

/** Standard XMTP content-type id for a group-metadata update. Matched as a
 *  substring so we don't depend on the exact version suffix. */
const GROUP_UPDATED = 'group_updated';

function isGroupUpdated(m: StreamMsg): boolean {
  const id = (m.msg as unknown as { contentTypeId?: string }).contentTypeId;
  return typeof id === 'string' && id.includes(GROUP_UPDATED);
}

let started = false;
/** Subscribe the convMeta-invalidation listener to the global stream. Idempotent
 *  + lazy: call from app boot or the first screen that cares. Returns a no-op if
 *  already wired (the underlying stream is a single shared fan-out). */
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeAllMessages((m: StreamMsg) => {
    if (m.convId && isGroupUpdated(m)) invalidateConvMeta(m.convId);
  });
}
