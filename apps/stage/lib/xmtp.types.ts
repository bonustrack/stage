import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';

export const XMTP_ENV = 'production';

export type XmtpEnv = typeof XMTP_ENV;

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
