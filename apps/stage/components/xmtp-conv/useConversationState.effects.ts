import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setActiveConversation } from '../../modules/stage-pill';
import { setActiveConvId } from '../../lib/activeConv';
import { getCachedRows, getConvConsentState, streamConvConsent, getGroupLabels } from '../../modules/messaging';
import {
  convScrollKey, getScrollOffset, peekScrollOffset, flushScrollOffset, getFeedAnchor, peekFeedAnchor, type FeedAnchor,
} from '../../lib/scrollPos';
import type { HistoryEntry } from '@stage-labs/client/types';
import {
  reactionsByMessage, ownReactionsByMessage,
  pollOptionCountsInFeed, votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from './feed-helpers';
import { useReconciledMap } from '../../lib/mapReconcile';

export function useActiveConvSuppression(convId: string | undefined): void {
  const activeConvId = useMemo(() => convId?.toLowerCase(), [convId]);
  useFocusEffect(useCallback(() => {
    if (!activeConvId) return;
    setActiveConversation(activeConvId);
    setActiveConvId(activeConvId);
    const sub = AppState.addEventListener('change', (s) => {
      const open = s === 'active' ? activeConvId : null;
      setActiveConversation(open);
      setActiveConvId(open);
    });
    return () => { sub.remove(); setActiveConversation(null); setActiveConvId(null); };
  }, [activeConvId]));
}

export function useConsentGate(convId: string | undefined): boolean | undefined {
  const [consentAllowed, setConsentAllowed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!convId) { setConsentAllowed(undefined); return; }
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      try {
        const state = await getConvConsentState(convId);
        if (!cancelled) setConsentAllowed(state == null ? undefined : state === 'allowed');
      } catch { if (!cancelled) setConsentAllowed(undefined); }
    };
    void resolve();
    let cancelConsent: (() => void) | null = null;
    try { cancelConsent = streamConvConsent(() => { void resolve(); }); } catch { }
    return () => { cancelled = true; cancelConsent?.(); };
  }, [convId]);
  return consentAllowed;
}

function cachedLabels(cid?: string): string[] {
  const v = getCachedRows()?.find(r => r.convId === cid)?.labels;
  return Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : [];
}

export function useGroupLabels(convId: string | undefined, activeLine: string, isGroup: boolean): string[] {
  const [groupLabels, setGroupLabels] = useState<string[]>(() => cachedLabels(convId));
  useEffect(() => {
    if (!isGroup) { setGroupLabels([]); return; }
    setGroupLabels(cachedLabels(convId));
    let cancelled = false;
    void getGroupLabels(activeLine).then(v => { if (!cancelled) setGroupLabels(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [convId, activeLine, isGroup]);
  return groupLabels;
}

export interface ScrollPersistence {
  savedScrollRef: React.MutableRefObject<number | undefined>;
  savedAnchorRef: React.MutableRefObject<FeedAnchor | null>;
  savedScrollLoaded: React.MutableRefObject<boolean>;
  didRestoreScroll: React.MutableRefObject<boolean>;
  pinBottomUntil: React.MutableRefObject<number>;
  isAtBottomRef: React.MutableRefObject<boolean>;
}

export function useConvScrollPersistence(convId: string | undefined): ScrollPersistence {
  const savedScrollRef = useRef<number | undefined>(undefined);
  const savedAnchorRef = useRef<FeedAnchor | null>(null);
  const savedScrollLoaded = useRef(false);
  const didRestoreScroll = useRef(false);
  const pinBottomUntil = useRef(0);
  const isAtBottomRef = useRef(true);
  useLayoutEffect(() => {
    if (!convId) return;
    const key = convScrollKey(convId);
    isAtBottomRef.current = true;
    didRestoreScroll.current = false;
    pinBottomUntil.current = 0;
    const cached = peekScrollOffset(key);
    const cachedAnchor = peekFeedAnchor(convId);
    if (cached !== undefined && cachedAnchor !== undefined) {
      savedScrollRef.current = cached;
      savedAnchorRef.current = cachedAnchor;
      savedScrollLoaded.current = true;
    } else {
      void Promise.all([getScrollOffset(key), getFeedAnchor(convId)]).then(([o, anchor]) => {
        savedScrollRef.current = o; savedAnchorRef.current = anchor; savedScrollLoaded.current = true;
      });
    }
    return () => { flushScrollOffset(key); };
  }, [convId]);
  return { savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef };
}

export function useFeedDerivations(events: HistoryEntry[], myUri: string) {
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useReconciledMap(useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]));
  const ownReactions = useReconciledMap(useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]));
  const votes = useReconciledMap(useMemo(() => votesByMessage(events), [events]));
  const ownVotes = useReconciledMap(useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]));
  const openAnswers = useReconciledMap(useMemo(() => openAnswersByMessage(events), [events]));
  return { reactions, ownReactions, votes, ownVotes, openAnswers };
}
