import { useEffect, useState } from 'react';
import { getConvConsentState, streamConvConsent } from '../../lib/xmtp.conv';
import type { XmtpConsent } from '../../lib/xmtp.types';
import { report, recover, attempt } from '../../lib/errorPolicy';

const knownConsent = new Map<string, XmtpConsent | null>();

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
