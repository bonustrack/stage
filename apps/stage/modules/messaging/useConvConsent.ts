import { useEffect, useState } from 'react';
import { getConvConsentState, groupAccessOf, streamConvConsent, type GroupAccess } from '../../lib/xmtp.conv';
import type { XmtpConsent } from '../../lib/xmtp.types';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { report, recover, attempt } from '../../lib/errorPolicy';

const knownConsent = new Map<string, XmtpConsent | null>();

export function rememberOwnGroup(convId: string): void {
  knownConsent.set(convId, 'allowed');
}

function lastKnownConsent(convId: string | undefined): XmtpConsent | null | undefined {
  return convId ? knownConsent.get(convId) : undefined;
}

export function useConvConsentState(convId: string | undefined): XmtpConsent | null | undefined {
  const [consent, setConsent] = useState<XmtpConsent | null | undefined>(() => lastKnownConsent(convId));
  useEffect(() => {
    setConsent(lastKnownConsent(convId));
    if (!convId) return;
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      const state = await getConvConsentState(convId).catch(recover('conversation.consent', null));
      knownConsent.set(convId, state);
      if (!cancelled) setConsent(state);
    };
    void resolve();
    let cancelConsent: (() => void) | null = null;
    try {
      cancelConsent = streamConvConsent(() => { void resolve(); });
    } catch (err) {
      report('conversation.consentStream', err);
    }
    return () => {
      cancelled = true;
      if (cancelConsent) attempt(cancelConsent, 'cleanup');
    };
  }, [convId]);
  return consent;
}

const RECHECK_MS = 10_000;

export function useGroupAccess(convId: string | undefined, isGroup: boolean): GroupAccess {
  const [access, setAccess] = useState<GroupAccess>('member');
  const epoch = useAccountEpoch();
  useEffect(() => {
    setAccess('member');
    if (!convId || !isGroup) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      const next = await groupAccessOf(convId).catch(recover<GroupAccess>('conversation.groupAccess', 'member'));
      if (cancelled) return;
      setAccess(next);
      if (next !== 'member') timer = setTimeout(() => { void check(); }, RECHECK_MS);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [convId, isGroup, epoch]);
  return access;
}
