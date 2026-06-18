/** Small composer hooks (per-conversation drafts, reply/auto focus, @-mention
 *  parsing) extracted from MessengerComposer.tsx for the lint line-budget.
 *  Behavior identical. */

import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { AppState, Keyboard } from 'react-native';
import type { Textarea } from '@metro-labs/kit/textarea';
import { loadDrafts, getDraft, setDraft } from '../lib/drafts';
import { loadLastAttachment, getLastAttachment, subscribeLastAttachment } from '../lib/lastAttachment';

/** Last-used attachment label, reactive: loads from storage on mount and updates
 *  whenever the user picks a new attachment type. undefined until first use. */
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

/** Per-conversation draft: restore on mount, persist (debounced) on change,
 *  keyed by convId so each channel keeps its own unsent text. */
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

/** Focus the input + raise the keyboard on a reply target (keyed on `nonce`,
 *  bumped on EVERY reply action — blur→focus re-raises reliably) or a reply-less
 *  autofocus signal. */
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
  /** On background, blur the input ONLY if the keyboard was already closed.
   *  The bug: a focused-but-keyboard-closed input gets its IME re-raised by
   *  Android on resume; blurring kills that. But blurring while the keyboard
   *  IS up desyncs react-native-keyboard-controller (on resume the IME is gone
   *  yet the sticky-view/feed offset stays raised -> floating composer / blank
   *  gap). So when the keyboard is visible we leave focus alone: Android
   *  restores both focus and IME cleanly, no stale offset. Intentional focus
   *  (input tap, reply-swipe, autoFocusNonce) is untouched. */
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

/** `@`-mention parser + matcher + inserter. Looks backwards from the cursor for
 *  the most recent `@` and grabs the token up to any whitespace. */
export function computeMentions(
  text: string,
  cursor: number,
  candidates: MentionCandidate[] | undefined,
): { matches: MentionCandidate[]; range: { start: number; end: number } | null } {
  if (!candidates || candidates.length === 0) return { matches: [], range: null };
  const before = text.slice(0, cursor);
  const m = /(^|\s)@(\S*)$/.exec(before);
  if (!m) return { matches: [], range: null };
  const query = (m[2] ?? '').toLowerCase();
  const start = cursor - query.length - 1;
  const matches = candidates
    .filter(c => !query || c.name.toLowerCase().includes(query) || c.address.toLowerCase().includes(query))
    .slice(0, 6);
  return { matches, range: { start, end: cursor } };
}

/** Insert the bare address as `@<address> ` — the stable wire form (survives
 *  username changes); the bubble renderer resolves it to a tappable `@<name>`.
 *  Trailing space prevents re-parsing as an active mention. */
export function applyMention(
  text: string,
  range: { start: number; end: number },
  address: string,
): { next: string; cursor: number } {
  const insert = `@${address.toLowerCase()} `;
  const next = text.slice(0, range.start) + insert + text.slice(range.end);
  return { next, cursor: range.start + insert.length };
}
