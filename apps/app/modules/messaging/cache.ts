/** Messaging caches, behind the facade.
 *
 *  Stage 2, MOVE/re-export only (NOT the TanStack-Query rewrite - that is a
 *  later proposal). Component code used to reach directly into two lib modules
 *  for the messaging caches:
 *
 *    - `lib/channelsCache`  the per-account channels-list cache (rows + unread
 *                           markers): getCachedRows / setCachedRows /
 *                           subscribeCachedRows / hydrateCachedRows /
 *                           markConvRead / markConvUnread / patchRowSent / etc.
 *    - `lib/xmtp.state`     the session caches keyed to the active inbox
 *                           (feedCache / activeFeedLines / inboxEthCache).
 *
 *  This barrel re-exposes that cache surface through the facade so components
 *  import the caches from `@/modules/messaging` instead of the lib internals.
 *  Logic is byte-identical - these are pure re-exports; the lib-internal
 *  consumers (xmtp.feed / xmtp.stream / xmtp.client) keep importing the lib
 *  modules directly. */

export {
  type CachedRow,
  getActiveAccountIdSync,
  setActiveAccountForCache,
  hydrateCachedRows,
  clearCachedRows,
  getCachedRows,
  setCachedRows,
  subscribeCachedRows,
  markConvRead,
  markConvUnread,
  patchRowSent,
} from '../../lib/channelsCache';

export {
  feedCache,
  activeFeedLines,
  inboxEthCache,
} from '../../lib/xmtp.state';
