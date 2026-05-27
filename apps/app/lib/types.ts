/** Re-export of the shared event/message envelope so existing call sites in
 *  apps/app keep their `./types` import path. The canonical definition lives in
 *  @metro-labs/client (shared with the web client). */

export type { HistoryEntry } from '@metro-labs/client/types';
