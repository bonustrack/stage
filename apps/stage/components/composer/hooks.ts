
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Keyboard } from 'react-native';
import { loadDrafts, getDraft, setDraft } from '../../lib/drafts';

export { useLastAttachment } from '../../lib/lastAttachment';

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
  convId: string,
  text: string,
  restore: (draft: string) => void,
): void {
  const draftRestored = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    draftRestored.current = false;
    void loadDrafts().then(() => {
      const d = getDraft(convId);
      if (d) restore(d);
      draftRestored.current = true;
    });
  }, [convId]);
  useEffect(() => {
    if (!draftRestored.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { setDraft(convId, text); }, 300);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [text, convId]);
}

export function useComposerFocus(
  bumpFocus: () => void,
  bumpBlur: () => void,
  replyTargetId: string | undefined,
  replyNonce: number | undefined,
  autoFocusNonce: number | undefined,
  caretToEnd: () => void,
): void {
  const innerRaf = useRef<number | null>(null);
  useEffect(() => {
    if (!replyTargetId) return;
    const raf = requestAnimationFrame(() => {
      bumpBlur();
      innerRaf.current = requestAnimationFrame(() => { bumpFocus(); });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (innerRaf.current !== null) cancelAnimationFrame(innerRaf.current);
    };
  }, [replyTargetId, replyNonce]);
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
