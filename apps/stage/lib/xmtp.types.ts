import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { isCallSignalType } from '@stage-labs/client/xmtp/call';

export type XmtpEnv = 'production' | 'dev' | 'local';

export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export type DmUnreachableReason = 'unregistered' | 'stale-installations' | null;

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface LocalAttachmentInput { fileUri: string; mimeType: string; filename: string }

export interface StreamMsg {
  convId: string | null;
  msg: StreamedMessage;
}

export interface StreamStatus {
  live: () => boolean;
  lastMessageAt: () => number;
  lastCloseAt: () => number;
  ensure: () => void;
}

export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine,
} from '@stage-labs/client/xmtp/line';

export { shortAddress } from '@stage-labs/client/identity/format';

const CONTROL_BODY_PREFIX = 'METRO_CTRL:';

export function isControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(CONTROL_BODY_PREFIX);
}

export function isHiddenEntry(entry: { text?: string; payload?: unknown }): boolean {
  return isControlBody(entry.text) || isCallSignalType((entry.payload as { contentType?: string } | undefined)?.contentType);
}

export const XMTP_ENV_KEY = 'xmtp.env';
