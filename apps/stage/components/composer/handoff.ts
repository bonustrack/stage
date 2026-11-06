import { useEffect } from 'react';
import { setDraft } from '../../lib/drafts';
import type { StartedSend } from './sendRun';
import type { Attachment } from './types';

const handedSends = new Map<string, StartedSend>();
const keptAttachments = new Map<string, Attachment[]>();

export function handOverSend(convId: string, started: StartedSend): void {
  handedSends.set(convId.toLowerCase(), started);
}

export function useTakeHandedSend(convId: string | null, take: (started: StartedSend) => void): void {
  useEffect(() => {
    if (convId === null) return;
    const key = convId.toLowerCase();
    const started = handedSends.get(key);
    if (started === undefined) return;
    handedSends.delete(key);
    take(started);
  }, [convId]);
}

export function keepAttachmentsUntilSent(draftKey: string, pending: Attachment[]): void {
  if (pending.length === 0) keptAttachments.delete(draftKey);
  else keptAttachments.set(draftKey, pending);
}

export function keptAttachmentsOf(draftKey: string): Attachment[] | undefined {
  return keptAttachments.get(draftKey);
}

export function discardComposerDraft(draftKey: string): void {
  setDraft(draftKey, '');
  keptAttachments.delete(draftKey);
}
