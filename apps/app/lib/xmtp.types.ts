
import type {
  DecodedMessage, ConversationVersion,
} from '@xmtp/react-native-sdk';

export type XmtpEnv = 'production' | 'dev' | 'local';

export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export type { ConversationVersion };

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface LocalAttachmentInput { fileUri: string; mimeType: string; filename: string }

export interface StreamMsg {
  convId: string | null;
  msg: DecodedMessage;
}

export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroDmPeerOf, metroConvIdOf,
} from '@stage-labs/client/xmtp/line';

export { shortAddress, stampAvatarUrl } from '@stage-labs/client/identity/format';
