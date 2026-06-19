/** @file Pure isCardActionBlocked decision that gates in-chat Sign/Pay card actions behind accepted (Allowed) consent so a stranger DM can't trigger a sign/pay tap. */
export function isCardActionBlocked(consentAllowed: boolean | undefined): boolean {
  return consentAllowed === false;
}
