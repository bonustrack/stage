import { useEffect } from 'react';
import type { Attachment } from './types';

export interface HandedDraft { text: string; pending: Attachment[] }

const handed = new Map<string, HandedDraft>();

export function handDraftTo(convId: string, draft: HandedDraft): void {
  handed.set(convId.toLowerCase(), draft);
}

export function useHandedDraft(convId: string | null, send: (draft: HandedDraft) => void): void {
  useEffect(() => {
    if (convId === null) return;
    const key = convId.toLowerCase();
    const draft = handed.get(key);
    if (draft === undefined) return;
    handed.delete(key);
    send(draft);
  }, [convId]);
}
