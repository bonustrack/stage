import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';

export type XmtpEnv = 'production' | 'dev' | 'local';

export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export type DmUnreachableReason = 'unregistered' | 'stale-installations' | null;

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface LocalAttachmentInput {
  fileUri: string;
  mimeType: string;
  filename: string;
}

export interface UploadedAttachment {
  url: string;
  contentDigest: string;
}

export type OnAttachmentsUploaded = (attachments: readonly UploadedAttachment[]) => void;

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

export const XMTP_ENV_KEY = 'xmtp.env';
