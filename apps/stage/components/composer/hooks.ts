
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Keyboard } from 'react-native';
import { loadDrafts, getDraft, setDraft } from '../../lib/drafts';
import type { ComposerState } from './state';
import type { Attachment } from './types';

export { useLastAttachment } from '../../lib/lastAttachment';

const keptAttachments = new Map<string, Attachment[]>();

export function clearComposerDraft(key: string): void {
  setDraft(key, '');
  keptAttachments.delete(key);
}

function useKeptAttachments(key: string | null, s: Pick<ComposerState, 'pending' | 'setPending'>): void {
  const restoring = useRef(false);
  useEffect(() => {
    const kept = key === null ? undefined : keptAttachments.get(key);
    if (kept === undefined) return;
    restoring.current = true;
    s.setPending(kept);
  }, [key]);
  useEffect(() => {
    if (key === null) return;
    if (restoring.current) { restoring.current = false; return; }
    if (s.pending.length > 0) keptAttachments.set(key, s.pending); else keptAttachments.delete(key);
  }, [key, s.pending]);
}

export function useCaretToEnd(
  text: string,
  setSelection: (range: { start: number; end: number }) => void,
): () => void {
  const textRef = useRef(text);
  textRef.current = text;
  return useCallback(() => {
    const end = textRef.current.length;
    setSelection({ start: end, end });
  }, [setSelection]);
}

export function useComposerDrafts(
  key: string | null,
  s: Pick<ComposerState, 'text' | 'pending' | 'setPending'>,
  restore: (draft: string) => void,
): void {
  const draftRestored = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useKeptAttachments(key, s);
  useEffect(() => {
    draftRestored.current = false;
    if (key === null) return;
    void loadDrafts().then(() => {
      const d = getDraft(key);
      if (d) restore(d);
      draftRestored.current = true;
    });
  }, [key]);
  useEffect(() => {
    if (key === null || !draftRestored.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { setDraft(key, s.text); }, 300);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [s.text, key]);
}

export function useComposerFocus(
  bumpFocus: () => void,
  bumpBlur: () => void,
  blurNonce: number,
  replyTargetId: string | undefined,
  replyNonce: number | undefined,
  autoFocusNonce: number | undefined,
  caretToEnd: () => void,
): void {
  const refocusAfterBlur = useRef(false);
  useEffect(() => {
    if (!replyTargetId) return;
    const raf = requestAnimationFrame(() => {
      refocusAfterBlur.current = true;
      bumpBlur();
    });
    return () => { cancelAnimationFrame(raf); };
  }, [replyTargetId, replyNonce]);
  useEffect(() => {
    if (!refocusAfterBlur.current) return;
    refocusAfterBlur.current = false;
    bumpFocus();
  }, [blurNonce]);
  useEffect(() => {
    if (!autoFocusNonce) return;
    const t = setTimeout(() => { caretToEnd(); bumpFocus(); }, 0);
    return () => { clearTimeout(t); };
  }, [autoFocusNonce]);
  useEffect(() => {
    let keyboardVisible = false;
    const showSub = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible = true; });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => { keyboardVisible = false; });
    const appSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && !keyboardVisible) bumpBlur();
    });
    return () => { showSub.remove(); hideSub.remove(); appSub.remove(); };
  }, []);
}
