/** Build a one-line clear-signed intent sentence from a matched ERC-7730 decode.
 *  Pure (no UI deps) so it's unit-testable and reused by MessengerBubble.decoded.
 *
 *  Derived GENERALLY from the descriptor's intent + the enriched (labelled +
 *  formatted) args — not hardcoded per function — so every descriptor (transfer,
 *  withdraw, swap, …) gets a sensible lead rather than a bare verb when an
 *  amount/recipient is present. */
import type { DecodedCall } from './txDecode';

/** Labels whose enriched value is a recipient-ish address (gets a "to" connector
 *  in the sentence). Everything else addressName is a subject named inline. */
const RECIPIENT_LABELS = /^(to|recipient|beneficiary|on behalf of|for debt holder)$/i;
/** Labels whose enriched value is the headline amount of the action. */
const AMOUNT_LABELS = /amount/i;

/** Shorten a checksummed address (unknown recipient) for inline display; leave a
 *  known-name value ("Permit2 (0x…)") or any non-address string intact. Mirrors
 *  shortAddress (6+4) without importing the RN-laden messaging barrel. */
function shortIfAddress(v: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(v) ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}

/** Shape: "<intent> <amount> to <recipient>" (e.g. "Send 10 USDC to 0xd8dA…6045"),
 *  with approve's "to spend" spelled out ("Approve Permit2 to spend Unlimited
 *  USDC"). Falls back to the bare intent when no enriched args fit. */
export function intentSentence(decoded: DecodedCall): string {
  const intent = decoded.intent ?? '';
  const labelled = decoded.args.filter((a) => a.label && a.formatted);
  const amount = labelled.find((a) => AMOUNT_LABELS.test(a.label!))?.formatted;
  const recipientRaw = labelled.find((a) => RECIPIENT_LABELS.test(a.label!))?.formatted;
  const recipient = recipientRaw ? shortIfAddress(recipientRaw) : undefined;
  // Approve: the amount is what's being authorized, so phrase it as "to spend".
  if (/^approve$/i.test(intent)) {
    const spender = labelled.find((a) => /spender/i.test(a.label!))?.formatted;
    const who = spender ? ` ${shortIfAddress(spender)}` : '';
    const what = amount ? ` to spend ${amount}` : '';
    return `Approve${who}${what}`;
  }
  // General action: "<intent> <amount> to <recipient>".
  const what = amount ? ` ${amount}` : '';
  const where = recipient ? ` to ${recipient}` : '';
  return `${intent}${what}${where}` || intent;
}
