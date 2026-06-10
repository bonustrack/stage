/** Shared composer types — leaf imported by both MessengerComposer.actions.ts
 *  and MessengerComposer.builders.ts to avoid a module cycle between them. */

import type { Attachment } from './MessengerComposer.helpers';

interface OptimisticEntry {
  localId: string;
  text: string;
  attachments: Attachment[];
  replyTo?: string;
  payload?: unknown;
}

export interface ComposerActionsArgs {
  xmtpLine: string;
  text: string;
  pending: Attachment[];
  replyingTo?: { id: string };
  /** When set, the composer is in EDIT mode: send() posts an edit of this
   *  message id instead of a new message. */
  editingTo?: { id: string };
  mentionCandidates?: { address: string }[];
  setPending: React.Dispatch<React.SetStateAction<Attachment[]>>;
  setText: (v: string) => void;
  setSending: (v: boolean) => void;
  setUploading: (v: boolean) => void;
  setErr: (v: string | null) => void;
  setRecording: (v: boolean) => void;
  setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  setLevels: React.Dispatch<React.SetStateAction<number[]>>;
  setPollOpen: (v: boolean) => void;
  pollQuestion: string; pollHeader: string; pollOptions: string[]; pollMulti: boolean;
  setPollQuestion: (v: string) => void; setPollHeader: (v: string) => void;
  setPollOptions: (v: string[]) => void; setPollMulti: (v: boolean) => void;
  setSigOpen: (v: boolean) => void;
  sigKind: 'personal' | 'eip712'; sigDesc: string; sigMessage: string; sigJson: string;
  setSigKind: (v: 'personal' | 'eip712') => void; setSigDesc: (v: string) => void;
  setSigMessage: (v: string) => void; setSigJson: (v: string) => void;
  setTxOpen: (v: boolean) => void;
  txTo: string; txAmount: string; txNote: string;
  setTxTo: (v: string) => void; setTxAmount: (v: string) => void; setTxNote: (v: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
  onClearReply?: () => void;
  /** Clear edit mode after an edit send completes (or is cancelled). */
  onClearEdit?: () => void;
}
