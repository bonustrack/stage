import { useEffect, useRef, useState } from 'react';
import type { CachedRow } from '../../lib/cachedRows.model';
import { hydrateCachedRows } from '../../lib/channelsCache';
import { AccountChangedError } from '../../lib/accountSelection';
import { report } from '../../lib/errorPolicy';
import { refreshChannels } from '../../lib/messaging/channelsSync';
import { useHomeRows } from '../../lib/messaging/homeRows';
import type { ShareScope } from '../../lib/shareDestination';

export function useShareRows(scope: ShareScope | null): {
  rows: CachedRow[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const rows = useHomeRows();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = (network = true): void => {
    if (scope === null) return;
    const request = ++generation.current;
    setRefreshing(true);
    setError(null);
    void hydrateCachedRows()
      .then(() => refreshChannels(network))
      .then((result) => {
        scope.assertCurrent();
        if (generation.current === request && result.failed)
          setError('Some channels could not be loaded. You can choose another channel or refresh.');
      })
      .catch((err: unknown) => {
        if (!(err instanceof AccountChangedError)) report('share.rows', err);
        if (generation.current === request) setError('Could not refresh channels. Try again when messaging is ready.');
      })
      .finally(() => {
        if (generation.current === request) setRefreshing(false);
      });
  };
  useEffect(() => {
    refresh(false);
    return () => {
      generation.current += 1;
    };
  }, [scope]);
  const shown = scope === null ? null : rows;
  return { rows: shown, loading: refreshing || (shown === null && error === null), error, refresh };
}
