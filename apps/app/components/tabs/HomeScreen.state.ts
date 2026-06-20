import { useEffect, useRef, useState } from 'react';
import type { FlatList } from 'react-native-gesture-handler';
import { getCachedRows, setCachedRows, subscribeCachedRows, ensureChannelsQueryBridge } from '../../modules/messaging';
import { loadPinnedIds, subscribePins } from '../../lib/pins';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { CHANNELS_SCROLL_KEY, getScrollOffset, flushScrollOffset } from '../../lib/scrollPos';
import type { Row as RowT } from './HomeScreen.helpers';

export interface RowMenu { convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null }

export interface ScrollRefs {
  listRef: React.RefObject<FlatList<RowT> | null>;
  savedOffsetRef: React.MutableRefObject<number | undefined>;
  didRestoreRef: React.MutableRefObject<boolean>;
  contentHeightRef: React.MutableRefObject<number>;
}

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

export function useHomeState(): HomeState {
  const [rows, setRowsState] = useState<RowT[] | null>(getCachedRows() as RowT[] | null);
  const setRows = (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)): void => {
    if (typeof next === 'function') {
      setRowsState(prev => { const v = next(prev); setCachedRows(v); return v; });
    } else {
      setRowsState(next); setCachedRows(next);
    }
  };
  useEffect(() => subscribeCachedRows(r => { setRowsState(r as RowT[] | null); }), []);
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

  useEffect(() => {
    void getScrollOffset(CHANNELS_SCROLL_KEY).then(o => { savedOffsetRef.current = o; });
    return () => { flushScrollOffset(CHANNELS_SCROLL_KEY); };
  }, []);
  useEffect(() => {
    void loadPinnedIds().then(setPinned);
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
