
import { type DecodedMessage } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from '@stage-labs/client/types';
import { mapDecodedToEnvelope } from '@stage-labs/client/xmtp/envelope';

export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  return mapDecodedToEnvelope(msg, line);
}
