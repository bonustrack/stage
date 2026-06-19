/**
 * @file Re-export of the shared HistoryEntry message-envelope type from @stage-labs/client.
 */
/** Re-export of the shared event/message envelope so existing call sites in apps/ui keep their `../lib/types` import path. The canonical definition lives in @stage-labs/client (shared with the mobile app). */

export type { HistoryEntry } from '@stage-labs/client/types';
