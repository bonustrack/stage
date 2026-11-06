import type { EntryPayload } from '@stage-labs/client/xmtp/entryPayload';

export interface Attachment {
  id: string;
  url: string;
  kind: string;
  mime: string;
  size: number;
  name?: string;
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
