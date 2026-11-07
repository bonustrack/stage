import type { EntryPayload } from '@stage-labs/client/xmtp/entryPayload';
import type { EntryAttachment } from '@stage-labs/client/xmtp/entryPayload';

export interface Attachment extends EntryAttachment {
  id: string;
  url: string;
  mime: string;
  size: number;
}

export interface OptimisticEntry {
  localId: string;
  text: string;
  attachments: Attachment[];
  replyTo?: string;
  payload?: EntryPayload;
}

export interface PostHooks {
  openLine: () => Promise<string | null>;
  setErr: (v: string | null) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}
