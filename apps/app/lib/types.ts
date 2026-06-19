/** @file Re-export of the shared event/message envelope so existing call sites in apps/app keep their `./types` import path; canonical definition lives in @stage-labs/client. */

export type { HistoryEntry } from '@stage-labs/client/types';
