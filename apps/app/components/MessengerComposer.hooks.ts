
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { AppState, Keyboard } from 'react-native';
import type { Textarea } from '@stage-labs/kit/react-native/textarea';
import { loadDrafts, getDraft, setDraft } from '../lib/drafts';
import { loadLastAttachment, getLastAttachment, subscribeLastAttachment } from '../lib/lastAttachment';
import { computeMentionQuery, matchMembers } from '@stage-labs/client/xmtp/mentions';

export function useLastAttachment(): string | undefined {
  const [label, setLabel] = useState<string | undefined>(getLastAttachment);
  useEffect(() => {
    loadLastAttachment();
    const sync = (): void => { setLabel(getLastAttachment()); };
    sync();
    return subscribeLastAttachment(sync);
  }, []);
  return label;
}

export function useComposerDrafts(convId: string, text: string, setText: (v: string) => void): void {
  const draftRestored = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    draftRestored.current = false;
    void loadDrafts().then(() => {
      const d = getDraft(convId);
      if (d) setText(d);
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
  inputRef: RefObject<ComponentRef<typeof Textarea> | null>,
  replyTargetId: string | undefined,
  replyNonce: number | undefined,
  autoFocusNonce: number | undefined,
): void {
  useEffect(() => {
    if (!replyTargetId) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.blur();
      inputRef.current?.focus();
    });
    return () => { cancelAnimationFrame(raf); };
  }, [replyTargetId, replyNonce]);
  useEffect(() => {
    if (!autoFocusNonce) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { clearTimeout(t); };
  }, [autoFocusNonce]);
  useEffect(() => {
    let keyboardVisible = false;
    const showSub = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible = true; });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => { keyboardVisible = false; });
    const appSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && !keyboardVisible) inputRef.current?.blur();
    });
    return () => { showSub.remove(); hideSub.remove(); appSub.remove(); };
  }, []);
}

interface MentionCandidate { address: string; name: string; cacheBuster?: number }

export function computeMentions(
  text: string,
  cursor: number,
  candidates: MentionCandidate[] | undefined,
): { matches: MentionCandidate[]; range: { start: number; end: number } | null } {
  const { range } = computeMentionQuery(text, cursor, candidates);
  if (!range || !candidates) return { matches: [], range: null };
  const query = text.slice(range.start + 1, range.end);
  return { matches: matchMembers(candidates, query), range };
}

export { applyMention } from '@stage-labs/client/xmtp/mentions';
