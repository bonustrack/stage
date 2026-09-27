import { useState } from 'react';
import { channelRefToken } from '@stage-labs/client/xmtp/channelRefs';
import { getCachedRows } from '../../modules/messaging';
import { activeChannelIndex, channelCandidatesOf, channelQuery, matchChannels, type ChannelCandidate } from './channels.model';
import { labelOf } from './mentions';
import { insertToken, mentionKeyAction, piecesOf } from './mentions.model';
import type { ComposerState } from './state';

export interface ChannelSuggest {
  matches: ChannelCandidate[];
  active: number;
  pick: (candidate: ChannelCandidate) => void;
  onKey: (key: string, shift: boolean) => boolean;
}

export function useChannelSuggest(s: ComposerState, convId: string): ChannelSuggest {
  const [active, setActive] = useState({ key: '', convId: '' });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const pieces = piecesOf(s.text, labelOf);
  const query = channelQuery(pieces, s.selection.start);
  const key = query ? `${query.range.start}:${query.text}` : '';
  const matches = query && dismissed !== key
    ? matchChannels(channelCandidatesOf(getCachedRows(), convId), query.text)
    : [];
  const index = activeChannelIndex(matches, key, active);

  const pick = (candidate: ChannelCandidate): void => {
    if (!query) return;
    const r = insertToken(pieces, query.range, channelRefToken(candidate.convId, candidate.name), labelOf);
    s.setText(r.wire);
    s.setSelection({ start: r.caret, end: r.caret });
    s.bumpFocus();
  };

  const onKey = (pressed: string, shift: boolean): boolean => {
    const action = mentionKeyAction(pressed, shift, matches.length, index);
    if (!action) return false;
    if (action.kind === 'move') setActive({ key, convId: matches[action.index]?.convId ?? '' });
    else if (action.kind === 'dismiss') setDismissed(key);
    else {
      const candidate = matches[index];
      if (candidate) pick(candidate);
    }
    return true;
  };

  return { matches, active: index, pick, onKey };
}
