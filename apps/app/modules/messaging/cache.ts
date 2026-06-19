/**
 * @file Re-exports the messaging caches (per-account channelsCache + unread markers and the xmtp.state session caches) behind the facade so components import them from `@/modules/messaging` rather than lib.
 */

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
