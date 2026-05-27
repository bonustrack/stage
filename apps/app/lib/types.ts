/** Re-export of the shared event/message envelope so existing call sites in
 *  apps/app keep their `./types` import path. The canonical definition lives in
 *  @stage-labs/metro-client (shared with the web client). */

export type { HistoryEntry } from '@stage-labs/metro-client/types';
