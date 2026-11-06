import { useEffect, useState } from 'react';
import { hiddenConsent } from '@stage-labs/client/xmtp/sync/clear';
import { getConvConsentState, groupAccessOf, streamConvConsent } from '../xmtp.conv';
import type { XmtpConsent } from '../xmtp.types';
import { getCachedRows, patchRowConsent, subscribeCachedRows } from '../channelsCache';
import { useStoreValue } from '../storeCore';
import type { ConversationView } from './conversation';
import { useAccountEpoch } from '../accountEpoch';
import { report, recover, attempt } from '../errorPolicy';
import { useHiddenChannels } from '../sync/hiddenChannels';
import { cachedChannelAccess, subscribeChannelAccess, type GroupAccess } from '../channelAccess';
import { knownConsentOf, rememberConsent } from '../channelVisibility';

function listedConsent(convId: string | undefined): XmtpConsent | undefined {
  const rows = getCachedRows() as ConversationView[] | null;
  return (convId ? rows?.find((r) => r.convId === convId)?.consent : null) ?? undefined;
}

export function useConvConsentState(convId: string | undefined): XmtpConsent | null | undefined {
  const hidden = useHiddenChannels()[convId ?? ''];
  const listed = useStoreValue(subscribeCachedRows, () => listedConsent(convId));
  const [checked, setChecked] = useState<XmtpConsent | null | undefined>(() => knownConsentOf(convId));
  useEffect(() => {
    setChecked(knownConsentOf(convId));
    if (!convId) return;
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      const state = await getConvConsentState(convId).catch(recover('conversation.consent', null));
      rememberConsent(convId, state);
      if (state) patchRowConsent(convId, state);
      if (!cancelled) setChecked(state);
    };
    void resolve();
    let cancelConsent: (() => void) | null = null;
    try {
      cancelConsent = streamConvConsent(() => {
        void resolve();
      });
    } catch (err) {
      report('conversation.consentStream', err);
    }
    return () => {
      cancelled = true;
      if (cancelConsent) attempt(cancelConsent, 'cleanup');
    };
  }, [convId]);
  return hiddenConsent(hidden, checked ?? listed ?? checked);
}

const RECHECK_MS = 10_000;

export function useGroupAccess(convId: string | undefined, isGroup: boolean): GroupAccess {
  const access = useStoreValue(subscribeChannelAccess, () => cachedChannelAccess(convId));
  const epoch = useAccountEpoch();
  useEffect(() => {
    if (!convId || !isGroup) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      const next = await groupAccessOf(convId).catch(recover<GroupAccess>('conversation.groupAccess', 'checking'));
      if (cancelled) return;
      if (next !== 'member')
        timer = setTimeout(() => {
          void check();
        }, RECHECK_MS);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [convId, isGroup, epoch, access]);
  return isGroup ? access : 'member';
}
