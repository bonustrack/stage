/** Re-export of the shared event/message envelope so existing call sites in
 *  apps/ui keep their `../lib/types` import path. The canonical definition
 *  lives in @stage-labs/metro-client (shared with the mobile app). */

export type { HistoryEntry } from '@stage-labs/metro-client/types';
