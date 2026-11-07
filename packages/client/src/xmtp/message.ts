import type { DeletedBy } from './deleteMessage';

export interface XmtpMessage {
  id: string;
  senderInboxId: string;
  sentNs: number;
  sentMs: number;
  contentTypeId: string;
  content: unknown;
  undecodable?: true;
  fallback?: string;
}

export interface CanonicalReaction {
  reference: string;
  content: string;
  removed: boolean;
  custom: boolean;
}

export interface CanonicalReply {
  reference: string;
  text?: string;
  remote?: Record<string, unknown>;
}

export interface CanonicalAttachment {
  filename?: string;
  mimeType?: string;
  dataB64: string;
}

export interface CanonicalDeletedMessage {
  deletedBy: DeletedBy;
}

export function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

export function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
