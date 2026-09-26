import { useState } from 'react';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import { mentionAddresses, mentionLabel } from '../bubble/mention.model';
import {
  applyDisplayEdit, displayOf, insertMention, mentionKeyAction, mentionQuery, piecesOf, toDisplay,
} from './mentions.model';
import type { ComposerState } from './state';

function labelOf(address: string): string {
  return mentionLabel(getPeerName(address) ?? shortAddress(address));
}

export interface MentionEditor {
  display: string;
  matches: MentionCandidate[];
  active: number;
  setDisplay: (next: string) => void;
  pick: (candidate: MentionCandidate) => void;
  onKey: (key: string, shift: boolean) => boolean;
  restore: (wire: string) => void;
}

export function useMentionEditor(s: ComposerState, candidates: MentionCandidate[] | undefined): MentionEditor {
  usePeerProfiles(mentionAddresses(s.text));
  const [active, setActive] = useState({ key: '', index: 0 });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const pieces = piecesOf(s.text, labelOf);
  const display = displayOf(pieces);
  const { matches, range } = mentionQuery(pieces, s.selection.start, candidates);
  const key = range ? `${range.start}:${display.slice(range.start, range.end)}` : '';
  const shown = range && dismissed !== key ? matches : [];
  const index = active.key === key ? Math.min(active.index, shown.length - 1) : 0;

  const pick = (candidate: MentionCandidate): void => {
    if (!range) return;
    const r = insertMention(pieces, range, candidate.address, labelOf);
    s.setText(r.wire);
    s.setSelection({ start: r.caret, end: r.caret });
    s.bumpFocus();
  };

  const onKey = (pressed: string, shift: boolean): boolean => {
    const action = mentionKeyAction(pressed, shift, shown.length, index);
    if (!action) return false;
    if (action.kind === 'move') setActive({ key, index: action.index });
    else if (action.kind === 'dismiss') setDismissed(key);
    else {
      const candidate = shown[index];
      if (candidate) pick(candidate);
    }
    return true;
  };

  const setDisplay = (next: string): void => {
    const r = applyDisplayEdit(pieces, next, labelOf, s.selection);
    setDismissed(null);
    s.setText(r.wire);
    if (r.display !== next) s.setSelection({ start: r.caret, end: r.caret });
  };

  const restore = (wire: string): void => {
    const end = toDisplay(wire, labelOf).length;
    s.setText(wire);
    s.setSelection({ start: end, end });
  };

  return { display, matches: shown, active: index, setDisplay, pick, onKey, restore };
}
