/** Shared XMTP types + pure string helpers for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there so
 *  every existing `from './xmtp'` import keeps resolving. No runtime deps on the
 *  other xmtp modules — safe to import from any of them. */

import type {
  Conversation, DecodedMessage, ConversationVersion,
} from '@xmtp/react-native-sdk';

export type XmtpEnv = 'production' | 'dev' | 'local';

/** Read/unread state lives ENTIRELY on the per-device `lastReadNs` marker — it is
 *  no longer coupled to XMTP consent. Consent (`allowed | denied | unknown`) is
 *  free to mean inbox / message-request / blocked. */
export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export type { ConversationVersion };

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

/** A locally-staged attachment ready to bundle into a multi-remote message.
 *  `fileUri` may be `file://`, `content://` (Android gallery) or `blob:` (web) —
 *  `materializeFileUri` normalises it to the `file://` URI the native
 *  `encryptAttachment` requires. */
export interface LocalAttachmentInput { fileUri: string; mimeType: string; filename: string }

/** A decoded inbound message, routed to channels-list subscribers (#1). Carries
 *  the conv id + the pre-decoded preview/sender so the list doesn't re-decode
 *  (the conv-view feedCache slice gets the same message via pushToFeedSlice). */
export interface StreamMsg {
  convId: string | null;
  /** The raw RN DecodedMessage — subscribers read senderInboxId/sentNs/id/
   *  content()/contentTypeId off it (channels list needs preview + sender). */
  msg: DecodedMessage;
}

/** `metro://` line-URI helpers (XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer,
 *  convIdOfLine, metroDmPeerOf, metroConvIdOf) moved into the framework-agnostic
 *  Stage SDK (@stage-labs/client). Re-exported so existing app imports stay
 *  stable. */
export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroDmPeerOf, metroConvIdOf,
} from '@stage-labs/client/xmtp/line';

/** Address-display + stamp.fyi avatar helpers (shortAddress, stampAvatarUrl)
 *  moved into the framework-agnostic Stage SDK (@stage-labs/client). Re-exported
 *  so existing app imports stay stable. */
export { shortAddress, stampAvatarUrl } from '@stage-labs/client/identity/format';

export type { Conversation, DecodedMessage };
