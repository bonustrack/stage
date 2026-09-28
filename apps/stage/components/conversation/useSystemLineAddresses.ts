import { useEffect, useMemo, useState } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import { inboxEthAddresses } from '../../modules/messaging';
import { reported } from '../../lib/errorPolicy';
import { unknownSystemLineInboxIds } from './systemNames.model';

export function useSystemLineAddresses(
  events: HistoryEntry[], inboxToAddr: Record<string, string>,
): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const missingKey = useMemo(() => unknownSystemLineInboxIds(events, inboxToAddr).join(','), [events, inboxToAddr]);
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    void inboxEthAddresses(missingKey.split(',')).then((found) => {
      if (!cancelled && Object.keys(found).length > 0) setResolved(prev => ({ ...prev, ...found }));
    }).catch(reported('conversation.systemLineAddresses'));
    return () => { cancelled = true; };
  }, [missingKey]);
  return useMemo(() => ({ ...resolved, ...inboxToAddr }), [resolved, inboxToAddr]);
}
