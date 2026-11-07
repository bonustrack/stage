import type { AttachmentId } from '../../lib/drafts';

interface AttachKind {
  id: AttachmentId;
  label: string;
  draft: boolean;
}

const ATTACH_KINDS: readonly AttachKind[] = [
  { id: 'voice', label: 'Voice message', draft: true },
  { id: 'image', label: 'Image', draft: true },
  { id: 'camera', label: 'Camera', draft: true },
  { id: 'file', label: 'File', draft: true },
  { id: 'location', label: 'Location', draft: false },
  { id: 'poll', label: 'Poll', draft: false },
  { id: 'sign', label: 'Sign', draft: false },
  { id: 'payment', label: 'Payment', draft: false },
];

export interface AttachOptions {
  draftOnly: boolean;
  voiceInMenu: boolean;
}

export function offeredAttachKinds({ draftOnly, voiceInMenu }: AttachOptions): AttachKind[] {
  return ATTACH_KINDS.filter((kind) => (kind.id !== 'voice' || voiceInMenu) && (!draftOnly || kind.draft));
}

export function quickAttachOf<A extends { id: AttachmentId }>(offered: readonly A[], last: AttachmentId | undefined): A | undefined {
  return offered.find((action) => action.id === last);
}
