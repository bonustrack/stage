import { useEffect, useRef, useState } from 'react';
import type { VirtualListHandle } from '../layout';
import { getCachedRows, setCachedRows, subscribeCachedRows } from '../../modules/messaging';
import { usePinnedOrder } from '../../lib/pins';
import {
  CHANNELS_SCROLL_KEY, getScrollOffset, peekScrollOffset, flushScrollOffset,
} from '../../lib/scrollPos';
import type { Row as RowT } from './helpers';
import type { MenuPoint } from '../AnchoredMenu.model';

export interface RowMenu {
  convId: string;
  isUnread: boolean;
  isGroup: boolean;
  peerAddress: string | null;
  anchor?: MenuPoint;
}

export interface ScrollRefs {
  listRef: React.RefObject<VirtualListHandle | null>;
  savedOffsetRef: React.MutableRefObject<number | undefined>;
  didRestoreRef: React.MutableRefObject<boolean>;
}

export interface HomeState {
  rows: RowT[] | null;
  setRowsState: React.Dispatch<React.SetStateAction<RowT[] | null>>;
  setRows: (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)) => void;
  error: string; setError: React.Dispatch<React.SetStateAction<string>>;
  rowMenu: RowMenu | null; setRowMenu: React.Dispatch<React.SetStateAction<RowMenu | null>>;
  pinned: readonly string[];
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

  const [error, setError] = useState<string>('');
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const pinned = usePinnedOrder();

  const listRef = useRef<VirtualListHandle>(null);
  const savedOffsetRef = useRef<number | undefined>(peekScrollOffset(CHANNELS_SCROLL_KEY));
  const didRestoreRef = useRef(false);

  useEffect(() => {
    void getScrollOffset(CHANNELS_SCROLL_KEY).then(o => { savedOffsetRef.current ??= o; });
    return () => { flushScrollOffset(CHANNELS_SCROLL_KEY); };
  }, []);

  return {
    rows, setRowsState, setRows, error, setError, rowMenu, setRowMenu,
    pinned,
    scroll: { listRef, savedOffsetRef, didRestoreRef },
  };
}
