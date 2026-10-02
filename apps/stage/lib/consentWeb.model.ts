import { ConsentState, type ListConversationsOptions } from '@xmtp/browser-sdk';
import type { XmtpConsent } from './xmtp.types';

const CONSENT_STATE: Record<XmtpConsent, ConsentState> = {
  allowed: ConsentState.Allowed,
  denied: ConsentState.Denied,
  unknown: ConsentState.Unknown,
};

export function webConsentState(consent: XmtpConsent): ConsentState {
  return CONSENT_STATE[consent];
}

export function webListOptions(consent: XmtpConsent[] | undefined): ListConversationsOptions | undefined {
  return consent ? { consentStates: consent.map(webConsentState) } : undefined;
}
