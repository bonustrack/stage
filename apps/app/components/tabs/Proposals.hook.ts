
import { useCallback, useState, useSyncExternalStore } from 'react';
import { proposalsStore } from './Proposals.store';
import type { QueuedRequest } from './Proposals.queue';

export function useProposalCount(): number {
  return useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.getCount,
    proposalsStore.getCount,
  );
}

export interface ProposalsState {
  current: QueuedRequest | null;
  loading: boolean;
  position: number;
  total: number;
  advance: () => void;
  refresh: () => void;
}

export function useProposals(): ProposalsState {
  const queue = useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.getQueue,
    proposalsStore.getQueue,
  );
  const ready = useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.isReady,
    proposalsStore.isReady,
  );

  const [seen, setSeen] = useState(0);

  const advance = useCallback(() => {
    const cur = proposalsStore.getQueue()[0];
    if (cur) {
      proposalsStore.skip(cur.key);
      setSeen(s => s + 1);
    }
  }, []);

  const refresh = useCallback(() => {
    setSeen(0);
    proposalsStore.refresh();
  }, []);

  const remaining = queue.length;
  const total = seen + remaining;
  return {
    current: queue[0] ?? null,
    loading: !ready,
    position: remaining === 0 ? 0 : seen + 1,
    total,
    advance,
    refresh,
  };
}
