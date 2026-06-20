/** @file Tx-request card wording: chooses transfer-vs-contract-call action verbs and success phrasing for a payment/tx request bubble. */

import type { DecodedCall } from '../lib/txDecode';

/** Function names that ARE a value/token movement (treated as a transfer, not a generic contract call) — keep the friendly payment wording for these. */
const TRANSFER_FNS = new Set([
  'transfer', 'transferfrom', 'send', 'safetransferfrom', 'pay',
]);

/** True when the request moves value/tokens (plain native transfer, an ERC-20 `transfer`, or no decoded call at all) rather than calling a contract fn. */
export function isTransferRequest(
  decoded: DecodedCall | null, isErc20Transfer: boolean,
): boolean {
  if (isErc20Transfer) return true; /** metadata.toAddress => transfer(token) */
  if (!decoded?.decoded) return true; /** no calldata => native transfer */
  const fn = (decoded.functionName ?? '').toLowerCase();
  return TRANSFER_FNS.has(fn);
}

/** Humanizes a decoded function name into a button action (e.g. setApprovalForAll -> "Set approval for all"), falling back to "Confirm" when there's no decoded name. */
export function humanizeAction(decoded: DecodedCall | null): string {
  const fn = decoded?.functionName;
  if (!fn) return 'Confirm';
  const lower = fn.toLowerCase();
  /** A few common verbs read better with a short, hand-tuned label. */
  const SPECIAL: Record<string, string> = {
    post: 'Post message',
    approve: 'Approve',
    setapprovalforall: 'Approve collection',
    mint: 'Mint',
    burn: 'Burn',
    vote: 'Vote',
    delegate: 'Delegate',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    stake: 'Stake',
    unstake: 'Unstake',
    claim: 'Claim',
  };
  if (SPECIAL[lower]) return SPECIAL[lower];
  /** Generic: split camelCase / snake_case into words, sentence-case the first. */
  const words = fn
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0];
  if (first === undefined) return 'Confirm';
  words[0] = first.charAt(0).toUpperCase() + first.slice(1);
  return words.join(' ');
}

/** The request-card primary button label. Transfers -> "Pay"; contract calls -> the humanized action (e.g. "Post message", fallback "Confirm"). */
export function txActionLabel(
  decoded: DecodedCall | null, isErc20Transfer: boolean,
): string {
  return isTransferRequest(decoded, isErc20Transfer) ? 'Pay' : humanizeAction(decoded);
}
