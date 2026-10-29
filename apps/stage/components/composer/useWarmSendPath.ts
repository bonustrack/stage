import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { getAccountEpoch, useAccountEpoch } from '../../lib/accountEpoch';
import { getAccountSelection, useAccountSelection } from '../../lib/accountSelection';
import { isAppInFront, subscribeAppInFront } from '../../lib/appInFront';
import { ignored } from '../../lib/errorPolicy';
import { warmSenderFilters } from '../../lib/pushRegister';
import { xmtpClient } from '../../lib/xmtp.client';
import type { ComposerState } from './state';

export function useWarmSendPath(line: string | undefined, draft: Pick<ComposerState, 'text' | 'pending'>): void {
  const focused = useIsFocused();
  const epoch = useAccountEpoch();
  const selection = useAccountSelection();
  useEffect(() => {
    if (line === undefined || !focused) return;
    let live = true;
    const current = (): boolean => live && isAppInFront() && getAccountEpoch() === epoch && getAccountSelection() === selection;
    const warm = (): void => {
      if (!current()) return;
      void xmtpClient()
        .then(async (client) => {
          if (current()) await warmSenderFilters(client);
        })
        .catch(ignored(undefined, 'optional'));
    };
    warm();
    const stop = subscribeAppInFront(warm);
    return () => {
      live = false;
      stop();
    };
  }, [line, focused, epoch, selection, draft.text, draft.pending.length]);
}
