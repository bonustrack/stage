/** @file useHomeState hook: rows state + cache bridge, pins/archived loads, and scroll-persistence refs for HomeScreen. */
import { useEffect, useRef, useState } from 'react';
import type { FlatList } from 'react-native-gesture-handler';
import { getCachedRows, setCachedRows, subscribeCachedRows, ensureChannelsQueryBridge } from '../../modules/messaging';
import { loadPinnedIds, subscribePins } from '../../lib/pins';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { CHANNELS_SCROLL_KEY, getScrollOffset, flushScrollOffset } from '../../lib/scrollPos';
import type { Row as RowT } from './HomeScreen.helpers';

/** Long-pressed row context surfaced in the per-conversation action sheet. */
export interface RowMenu { convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null }

/** Scroll-persistence refs for the channels FlatList. */
export interface ScrollRefs {
  listRef: React.RefObject<FlatList<RowT> | null>;
  savedOffsetRef: React.MutableRefObject<number | undefined>;
  didRestoreRef: React.MutableRefObject<boolean>;
  contentHeightRef: React.MutableRefObject<number>;
}

/** All of HomeScreen's local state, cache-bridged setRows, and supporting refs. */
export interface HomeState {
  rows: RowT[] | null;
  setRowsState: React.Dispatch<React.SetStateAction<RowT[] | null>>;
  setRows: (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)) => void;
  error: string; setError: React.Dispatch<React.SetStateAction<string>>;
  rowMenu: RowMenu | null; setRowMenu: React.Dispatch<React.SetStateAction<RowMenu | null>>;
  requestCount: number; setRequestCount: React.Dispatch<React.SetStateAction<number>>;
  pinned: Set<string>;
  archived: Set<string>;
  refreshFromNetworkRef: React.MutableRefObject<(() => Promise<void>) | null>;
  scroll: ScrollRefs;
}

/** Allocate HomeScreen's rows state, wire the shared-cache bridge, and load pins/archived/scroll. */
export function useHomeState(): HomeState {
  const [rows, setRowsState] = useState<RowT[] | null>(getCachedRows() as RowT[] | null);
  /** Wrap setRows so every update also lands in the shared cache + fans out to subscribers. */
  const setRows = (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)): void => {
    if (typeof next === 'function') {
      setRowsState(prev => { const v = next(prev); setCachedRows(v); return v; });
    } else {
      setRowsState(next); setCachedRows(next);
    }
  };
  useEffect(() => subscribeCachedRows(r => { setRowsState(r as RowT[] | null); }), []);
  /** Mirror the channels cache into TanStack Query so read-only consumers dedupe off one entry. */
  useEffect(() => { ensureChannelsQueryBridge(); }, []);

  const [error, setError] = useState<string>('');
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const [requestCount, setRequestCount] = useState<number>(0);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());

  const refreshFromNetworkRef = useRef<(() => Promise<void>) | null>(null);
  const listRef = useRef<FlatList<RowT>>(null);
  const savedOffsetRef = useRef<number | undefined>(undefined);
  const didRestoreRef = useRef(false);
  const contentHeightRef = useRef(0);

  /** Load saved scroll offset once; actual scroll happens in onContentSizeChange. */
  useEffect(() => {
    void getScrollOffset(CHANNELS_SCROLL_KEY).then(o => { savedOffsetRef.current = o; });
    return () => { flushScrollOffset(CHANNELS_SCROLL_KEY); };
  }, []);
  useEffect(() => {
    void loadPinnedIds().then(setPinned);
    /** On toggle the cache is already updated; re-read into a fresh Set so React sees a new ref. */
    return subscribePins(() => { void loadPinnedIds().then(s => { setPinned(new Set(s)); }); });
  }, []);
  useEffect(() => {
    void loadArchivedIds().then(setArchived);
    return subscribeArchived(() => { void loadArchivedIds().then(s => { setArchived(new Set(s)); }); });
  }, []);

  return {
    rows, setRowsState, setRows, error, setError, rowMenu, setRowMenu,
    requestCount, setRequestCount, pinned, archived, refreshFromNetworkRef,
    scroll: { listRef, savedOffsetRef, didRestoreRef, contentHeightRef },
  };
}
