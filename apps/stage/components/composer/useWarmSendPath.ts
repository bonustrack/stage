import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useAccountSelection } from '../../lib/accountSelection';
import { subscribeAppInFront } from '../../lib/appInFront';
import { warmSendPath } from '../../lib/pushRegister';
import type { ComposerState } from './state';

export function useWarmSendPath(line: string | undefined, draft: Pick<ComposerState, 'text' | 'pending'>): void {
  const composing = useIsFocused() && line !== undefined;
  const epoch = useAccountEpoch();
  const selection = useAccountSelection();
  useEffect(() => (composing ? subscribeAppInFront(warmSendPath) : undefined), [composing]);
  useEffect(() => {
    if (composing) warmSendPath();
  }, [composing, line, epoch, selection, draft.text, draft.pending.length]);
}
