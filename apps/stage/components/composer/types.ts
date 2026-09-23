export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

export const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;

export interface OptimisticEntry {
  localId: string;
  text: string;
  attachments: Attachment[];
  replyTo?: string;
  payload?: unknown;
}

export interface PostHooks {
  xmtpLine: string;
  setErr: (v: string | null) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}
