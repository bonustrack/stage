
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Keyboard } from 'react-native';
import { loadDrafts, getDraftValue, setDraft, setDraftValue } from '../../lib/drafts';
import type { ComposerState } from './state';
import type { Attachment } from './types';

const keptAttachments = new Map<string, Attachment[]>();

const TEXT_SAVE_DELAY_MS = 300;

export function clearComposerDraft(key: string): void {
  setDraft(key, '');
  keptAttachments.delete(key);
}

function useKeptInMemory<T>(
  kept: Map<string, T>, key: string | null, value: T, restore: (value: T) => void, empty: boolean,
): void {
  const restoring = useRef(false);
  useEffect(() => {
    const found = key === null ? undefined : kept.get(key);
    if (found === undefined) return;
    restoring.current = true;
    restore(found);
  }, [key]);
  useEffect(() => {
    if (key === null) return;
    if (restoring.current) { restoring.current = false; return; }
    if (empty) kept.delete(key); else kept.set(key, value);
  }, [key, value]);
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

export function useSavedDraft(
  key: string | null, value: unknown, restore: (saved: unknown) => void, delayMs = 0,
): void {
  const restored = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    restored.current = false;
    if (key === null) return;
    void loadDrafts().then(() => {
      restore(getDraftValue(key));
      restored.current = true;
    });
  }, [key]);
  useEffect(() => {
    if (key === null || !restored.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDraftValue(key, value); }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, key]);
}

export function useComposerDrafts(
  key: string | null,
  s: Pick<ComposerState, 'text' | 'pending' | 'setPending'>,
  restore: (draft: string) => void,
): void {
  useKeptInMemory(keptAttachments, key, s.pending, s.setPending, s.pending.length === 0);
  useSavedDraft(key, s.text.trim() ? s.text : undefined, (saved) => {
    if (typeof saved === 'string' && saved) restore(saved);
  }, TEXT_SAVE_DELAY_MS);
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
