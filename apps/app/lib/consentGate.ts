export function isCardActionBlocked(consentAllowed: boolean | undefined): boolean {
  return consentAllowed === false;
}
