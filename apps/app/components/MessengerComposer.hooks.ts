/** Small composer hooks (per-conversation drafts, reply/auto focus, @-mention
 *  parsing) extracted from MessengerComposer.tsx for the lint line-budget.
 *  Behavior identical. */

import { useEffect, useRef, type RefObject } from 'react';
import type { TextInput } from 'react-native';
import { loadDrafts, getDraft, setDraft } from '../lib/drafts';

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
  inputRef: RefObject<TextInput | null>,
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
    return () => cancelAnimationFrame(raf);
  }, [replyTargetId, replyNonce]);
  useEffect(() => {
    if (!autoFocusNonce) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocusNonce]);
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
