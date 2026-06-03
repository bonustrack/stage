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

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the daemon-side train
 *  (`packages/metro/examples/xmtp.ts`) so the rest of the app can rely on a single
 *  convention. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

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

/** Format a metro-style line URI for an XMTP conversation. Mirrors the daemon train. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

/** Extract the XMTP conversation id from a `metro://xmtp/<convId>` line URI.
 *  Returns null when the line doesn't match. */
export function convIdOfLine(line: string): string | null {
  const m = line.match(/^metro:\/\/xmtp\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** stamp.fyi avatar URL for an Ethereum address. Matches the host sx-monorepo uses
 *  (`apps/ui/src/helpers/stamp.ts`). The CDN returns a 200 with a generic identicon
 *  when no custom avatar is set, so callers can render this URL directly without
 *  needing a network-error fallback.
 *
 *  Takes the DISPLAY px and internally requests `s = displayPx * 2` so every
 *  call site renders a crisp retina (2×) identicon from a single source of truth
 *  (mirrors `stampAvatarUrl` in @metro-labs/kit/avatar). Pass the on-screen size,
 *  NOT a pre-doubled value.
 *
 *  `cacheBust` is appended verbatim as `&cb=…` — pass a value that changes when
 *  the underlying avatar changes (e.g. the last few chars of the IPFS CID
 *  stored in profile.avatar) so the device + stamp CDN refetch instead of
 *  serving the previous image. */
export function stampBoxAvatarUrl(address: string, displayPx = 60, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${displayPx * 2}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export type { Conversation, DecodedMessage };
