/** @file Thin typed adapter mapping a native RN decoded XMTP message to the app/daemon `HistoryEntry` envelope via the SDK's pure `mapDecodedToEnvelope`; kept for back-compat so existing `envelopeOfXmtpMessage` imports keep resolving. */

import { type DecodedMessage } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { mapDecodedToEnvelope } from '@stage-labs/client/xmtp/envelope';

/** Convert a decoded XMTP message into the `HistoryEntry` envelope used by the daemon-side event log + the MessengerBubble renderer. Delegates to the SDK's pure mapper; the native message is passed straight through (it satisfies `DecodedMessageView`). */
export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  return mapDecodedToEnvelope(msg, line);
}
