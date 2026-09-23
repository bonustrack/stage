import { useEffect, useRef, useState } from 'react';
import type { VirtualListHandle } from '../layout';
import { getCachedRows, setCachedRows, subscribeCachedRows } from '../../modules/messaging';
import { usePinnedOrder } from '../../lib/pins';
import { useStoreValue } from '../../lib/storeCore';
import {
  CHANNELS_SCROLL_KEY, getScrollOffset, peekScrollOffset, flushScrollOffset,
} from '../../lib/scrollPos';
import type { MenuPoint } from '../AnchoredMenu.model';
import type { Row } from './model';

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

interface HomeState {
  rows: Row[] | null;
  error: string; setError: React.Dispatch<React.SetStateAction<string>>;
  rowMenu: RowMenu | null; setRowMenu: React.Dispatch<React.SetStateAction<RowMenu | null>>;
  pinned: readonly string[];
  scroll: ScrollRefs;
}

export function homeRows(): Row[] | null {
  return getCachedRows() as Row[] | null;
}

export function updateHomeRows(fn: (prev: Row[] | null) => Row[] | null): void {
  setCachedRows(fn(homeRows()));
}

export function useHomeState(): HomeState {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
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
    rows, error, setError, rowMenu, setRowMenu,
    pinned,
    scroll: { listRef, savedOffsetRef, didRestoreRef },
  };
}
