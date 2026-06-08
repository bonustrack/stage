/** Messaging caches behind the facade. Re-exposes the channelsCache
 *  (per-account channels list + unread markers) and xmtp.state session caches
 *  (feedCache / activeFeedLines / inboxEthCache) so components import them from
 *  `@/modules/messaging` instead of lib. The lib-internal consumers (xmtp.feed /
 *  xmtp.stream / xmtp.client) keep importing the lib modules directly. */

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
