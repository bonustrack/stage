export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

export function consentStateToString(state: number): XmtpConsent {
  return state === 1 ? 'allowed' : state === 2 ? 'denied' : 'unknown';
}
