/** Broker primitives: claims map + per-user byte-offset cursors over history.jsonl. */
/** Re-export facade; implementation lives under ./broker/. */

export {
  CLAIMS_FILE,
  HISTORY_FILE,
  readClaims,
  claimLine,
  releaseLine,
  classifyLine,
  tryAutoClaim,
  type ClaimsMap,
  type AutoClaimResult,
  type LineKind,
} from './broker/claims.js';

export {
  userSlug,
  cursorKey,
  readCursor,
  writeCursor,
  historySize,
  readEntriesFrom,
  passesMode,
  type Mode,
} from './broker/history-stream.js';
