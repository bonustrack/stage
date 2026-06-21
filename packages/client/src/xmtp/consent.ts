
export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export function consentStateToString(state: number): XmtpConsent {
  return state === 1 ? 'allowed' : state === 2 ? 'denied' : 'unknown';
}

export function stringToConsentState(s: XmtpConsent): number {
  return s === 'allowed' ? 1 : s === 'denied' ? 2 : 0;
}
