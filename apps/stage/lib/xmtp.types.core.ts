import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';

export type XmtpEnv = 'production' | 'dev' | 'local';

export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export type DmUnreachableReason = 'unregistered' | 'stale-installations' | null;

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface LocalAttachmentInput { fileUri: string; mimeType: string; filename: string }

export interface StreamMsg {
  convId: string | null;
  msg: StreamedMessage;
}

export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, stageDmPeerOf, stageConvIdOf,
} from '@stage-labs/client/xmtp/line';

export { shortAddress, stampAvatarUrl } from '@stage-labs/client/identity/format';

const CONTROL_BODY_PREFIX = 'METRO_CTRL:';

export function isControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(CONTROL_BODY_PREFIX);
}

export const XMTP_ENV_KEY = 'xmtp.env';
