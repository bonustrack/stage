import { useState } from 'react';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';
import { channelRefToken } from '@stage-labs/client/xmtp/channelRefs';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useContactList } from '../../lib/useContacts';
import { getActiveAccountIdSync, getCachedRows } from '../../lib/channelsCache';
import { mentionAddresses } from '@stage-labs/client/xmtp/messageBody';
import { mentionLabelOf as labelOf } from '../conversation/convTitle';
import {
  activeSuggestIndex, applyDisplayEdit, displayOf, insertMention, insertToken, mentionKeyAction, mentionQuery, piecesOf,
  toDisplay, withContactCandidates, type Piece,
} from './mentions.model';
import { channelCandidatesOf, channelQuery, matchChannels, type ChannelCandidate } from './channels.model';
import type { ComposerState } from './state';

export interface SuggestAvatar { address: string | null; imageUri?: string | null; square?: boolean }

export interface Suggest<T> {
  matches: T[];
  active: number;
  pick: (candidate: T) => void;
  onKey: (key: string, shift: boolean) => boolean;
  idOf: (candidate: T) => string;
  avatarOf: (candidate: T) => SuggestAvatar;
}

type SuggestConfig<T> = Pick<Suggest<T>, 'idOf' | 'avatarOf'> & {
  key: string;
  matchesOf: () => T[];
  insert: (candidate: T) => { wire: string; caret: number } | null;
};

function useSuggest<T>(s: ComposerState, config: SuggestConfig<T>): Suggest<T> & { undismiss: () => void } {
  const { key, idOf } = config;
  const [active, setActive] = useState({ key: '', id: '' });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const shown = key !== '' && dismissed !== key ? config.matchesOf() : [];
  const index = activeSuggestIndex(shown, key, active, idOf);

  const pick = (candidate: T): void => {
    const r = config.insert(candidate);
    if (!r) return;
    s.setText(r.wire);
    s.setSelection({ start: r.caret, end: r.caret });
    s.bumpFocus();
  };

  const onKey = (pressed: string, shift: boolean): boolean => {
    const action = mentionKeyAction(pressed, shift, shown.length, index);
    if (!action) return false;
    if (action.kind === 'move') {
      const next = shown[action.index];
      setActive({ key, id: next === undefined ? '' : idOf(next) });
    } else if (action.kind === 'dismiss') setDismissed(key);
    else {
      const candidate = shown[index];
      if (candidate !== undefined) pick(candidate);
    }
    return true;
  };

  return {
    matches: shown, active: index, pick, onKey, idOf, avatarOf: config.avatarOf,
    undismiss: () => { setDismissed(null); },
  };
}

export type MentionEditor = Suggest<MentionCandidate> & {
  display: string;
  setDisplay: (next: string) => void;
  restore: (wire: string) => void;
};

function useCandidatePool(
  pieces: Piece[], cursor: number, candidates: MentionCandidate[] | undefined, suggestContacts: boolean,
): MentionCandidate[] | undefined {
  const typing = suggestContacts && mentionQuery(pieces, cursor, candidates).range !== null;
  const contacts = useContactList(typing);
  if (!suggestContacts) return candidates;
  return withContactCandidates(candidates ?? [], contacts, getActiveAccountIdSync());
}

const mentionIdOf = (candidate: MentionCandidate): string => candidate.address;
const mentionAvatarOf = (candidate: MentionCandidate): SuggestAvatar => ({ address: candidate.address });

export function useMentionEditor(
  s: ComposerState, candidates: MentionCandidate[] | undefined, suggestContacts: boolean,
): MentionEditor {
  usePeerProfiles(mentionAddresses(s.text));
  const pieces = piecesOf(s.text, labelOf);
  const display = displayOf(pieces);
  const pool = useCandidatePool(pieces, s.selection.start, candidates, suggestContacts);
  const { matches, range } = mentionQuery(pieces, s.selection.start, pool);
  const suggest = useSuggest(s, {
    key: range ? `${range.start}:${display.slice(range.start, range.end)}` : '',
    matchesOf: () => matches,
    insert: (candidate) => (range ? insertMention(pieces, range, candidate.address, labelOf) : null),
    idOf: mentionIdOf,
    avatarOf: mentionAvatarOf,
  });

  const setDisplay = (next: string): void => {
    const r = applyDisplayEdit(pieces, next, labelOf, s.selection);
    suggest.undismiss();
    s.setText(r.wire);
    if (r.display !== next) s.setSelection({ start: r.caret, end: r.caret });
  };

  const restore = (wire: string): void => {
    const end = toDisplay(wire, labelOf).length;
    s.setText(wire);
    s.setSelection({ start: end, end });
  };

  return { ...suggest, display, setDisplay, restore };
}

const channelIdOf = (candidate: ChannelCandidate): string => candidate.convId;
const channelAvatarOf = (candidate: ChannelCandidate): SuggestAvatar => (
  { address: candidate.avatarAddress, imageUri: candidate.avatarUri, square: true }
);

export function useChannelSuggest(s: ComposerState, convId: string): Suggest<ChannelCandidate> {
  const pieces = piecesOf(s.text, labelOf);
  const query = channelQuery(pieces, s.selection.start);
  return useSuggest(s, {
    key: query ? `${query.range.start}:${query.text}` : '',
    matchesOf: () => (query ? matchChannels(channelCandidatesOf(getCachedRows(), convId), query.text) : []),
    insert: (candidate) => (
      query ? insertToken(pieces, query.range, channelRefToken(candidate.convId, candidate.name), labelOf) : null
    ),
    idOf: channelIdOf,
    avatarOf: channelAvatarOf,
  });
}
