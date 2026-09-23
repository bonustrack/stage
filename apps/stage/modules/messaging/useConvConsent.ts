import { useEffect, useState } from 'react';
import { getConvConsentState, streamConvConsent } from '../../lib/xmtp.conv';
import type { XmtpConsent } from '../../lib/xmtp.types';
import { report, recover, attempt } from '../../lib/errorPolicy';

export function useConvConsentState(convId: string | undefined): XmtpConsent | null | undefined {
  const [consent, setConsent] = useState<XmtpConsent | null | undefined>(undefined);
  useEffect(() => {
    if (!convId) { setConsent(undefined); return; }
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      const state = await getConvConsentState(convId).catch(recover('conversation.consent', null));
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
