/** Map a decoded XMTP message → the app/daemon `HistoryEntry` envelope.
 *
 *  The pure shaping logic moved into the Stage SDK
 *  (@metro-labs/client/xmtp/envelope `mapDecodedToEnvelope`), which operates on a
 *  structural `DecodedMessageView`. The native RN `DecodedMessage` satisfies that
 *  view, so this is a thin typed adapter kept for back-compat: every existing
 *  `from './xmtp'` import of `envelopeOfXmtpMessage` keeps resolving. */

import { type DecodedMessage } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { mapDecodedToEnvelope, type DecodedMessageView } from '@metro-labs/client/xmtp/envelope';

/** Convert a decoded XMTP message into the `HistoryEntry` envelope used by the
 *  daemon-side event log + the MessengerBubble renderer. Delegates to the SDK's
 *  pure mapper; the native message is passed straight through (it satisfies
 *  `DecodedMessageView`). */
export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  return mapDecodedToEnvelope(msg as unknown as DecodedMessageView, line);
}
