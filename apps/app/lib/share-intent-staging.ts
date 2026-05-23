/** Module-level stash for attachments received via Android Share Intent. The root
 *  layout uploads incoming files when a share intent arrives, queues them here,
 *  then navigates to the messenger tab. The composer drains the queue on mount /
 *  focus so the attachments appear pre-staged in the input. */

import type { Attachment } from './messenger';

let staged: Attachment[] = [];

export function pushStagedAttachments(...items: Attachment[]): void {
  staged = [...staged, ...items];
}

export function drainStagedAttachments(): Attachment[] {
  const out = staged;
  staged = [];
  return out;
}

export function hasStagedAttachments(): boolean {
  return staged.length > 0;
}
