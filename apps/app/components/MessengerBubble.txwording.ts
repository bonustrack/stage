
import type { DecodedCall } from '../lib/txDecode';

const TRANSFER_FNS = new Set([
  'transfer', 'transferfrom', 'send', 'safetransferfrom', 'pay',
]);

export function isTransferRequest(
  decoded: DecodedCall | null, isErc20Transfer: boolean,
): boolean {
  if (isErc20Transfer) return true;
  if (!decoded?.decoded) return true;
  const fn = (decoded.functionName ?? '').toLowerCase();
  return TRANSFER_FNS.has(fn);
}

export function humanizeAction(decoded: DecodedCall | null): string {
  const fn = decoded?.functionName;
  if (!fn) return 'Confirm';
  const lower = fn.toLowerCase();
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

export function txActionLabel(
  decoded: DecodedCall | null, isErc20Transfer: boolean,
): string {
  return isTransferRequest(decoded, isErc20Transfer) ? 'Pay' : humanizeAction(decoded);
}
