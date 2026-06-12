/** Consent gating for in-chat Sign/Pay request cards (audit HIGH/#2).
 *
 *  The XMTP message stream surfaces messages from `allowed` AND `unknown`
 *  (unaccepted / stranger) conversations so pending DMs land in the Requests
 *  bucket. That means a stranger can post a live Sign or Pay request card. The
 *  ACTIONS on those cards must be gated behind ConsentState.Allowed so a single
 *  tap can't sign / pay for a sender the user never accepted.
 *
 *  This is the single pure decision the cards use (so it is unit-testable without
 *  a render harness). `consentAllowed`:
 *    - `undefined` => unresolved (the common already-accepted case; do NOT gate,
 *                     so an allowed conv never flickers a disabled button while
 *                     consent resolves async). Resolves to `true`/`false` shortly.
 *    - `true`      => allowed conversation -> action enabled.
 *    - `false`     => unknown / stranger DM -> action BLOCKED.
 */
export function isCardActionBlocked(consentAllowed: boolean | undefined): boolean {
  return consentAllowed === false;
}
