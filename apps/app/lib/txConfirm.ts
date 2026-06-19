/**
 * @file Anti-spoof confirm-summary derivation for in-chat payment requests (EIP-5792 walletSendCalls) from an untrusted peer, deriving the to/amount ONLY from the calldata that will actually be broadcast — never the unbound display `metadata`.
 *  Unrecognised calldata yields an `unverified` summary (raw target + selector) so the sheet warns instead of showing a spoofable line; pure + synchronous so it is unit-testable.
 */

import { decodeFunctionData, formatEther, formatUnits, isAddress, type Hex } from 'viem';

/** Minimal ABI for ERC-20 `transfer(address,uint256)` — the only method we decode for a "verified" payment summary. */
const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/** Known ERC-20 tokens (lowercased contract address -> symbol/decimals) for a friendly amount label. Unknown tokens still get a verified recipient/amount, just labelled by the raw token contract + atomic units. USDC across chains. */
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 }, // Base
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 }, // Ethereum
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 }, // Base Sepolia
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 }, // Sepolia
};

/** The verified transaction summary derived from the actual call bytes. */
export interface ConfirmSummary {
  /** True when we could fully decode the call into a known transfer shape. When false the caller MUST show a warning, not a friendly send line. */
  verified: boolean;
  /** The on-chain recipient of value (decoded transfer arg, or call.to native). */
  recipient: string;
  /** Human amount string (exact, via viem formatUnits/formatEther). */
  amount?: string;
  /** Token/coin symbol for the amount (e.g. USDC, ETH), when resolvable. */
  symbol?: string;
  /** For an unverified call: the contract the tx targets. */
  target?: string;
  /** For an unverified call: the 4-byte selector of call.data (0x + 8 hex). */
  selector?: string;
}

interface CallLike {
  to?: string;
  data?: string;
  value?: string;
}

/** Selector Of. */
function selectorOf(data?: string): string | undefined {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return undefined;
  return data.slice(0, 10).toLowerCase();
}

/** Derive the confirm summary from the ACTUAL call bytes. `nativeSymbol` is the chain's native coin symbol (default ETH) used for value-only sends. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 15)
export function deriveConfirmSummary(
  call: CallLike,
  nativeSymbol = 'ETH',
): ConfirmSummary {
  const to = call.to;
  const hasData = !!call.data && call.data !== '0x' && call.data.length > 2;

  // Native send: no calldata. Recipient = call.to, amount = call.value (wei).
  if (!hasData) {
    const wei = (() => {
      try { return BigInt(call.value ?? '0x0'); } catch { return null; }
    })();
    if (to && isAddress(to) && wei !== null) {
      return {
        verified: true,
        recipient: to,
        amount: formatEther(wei),
        symbol: nativeSymbol,
      };
    }
    // Malformed native call.
    return {
      verified: false,
      recipient: to ?? '(unknown)',
      target: to,
      selector: undefined,
    };
  }

  // Has calldata: only an ERC-20 transfer(address,uint256) is "verified".
  try {
    const decoded = decodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      data: call.data as Hex,
    });
    if (decoded.functionName === 'transfer') {
      const [recipient, rawAmount] = decoded.args as readonly [string, bigint];
      const token = (to ?? '').toLowerCase();
      const known = KNOWN_TOKENS[token];
      const amount = known
        ? formatUnits(rawAmount, known.decimals)
        : rawAmount.toString(); // unknown token: show atomic units, no false symbol
      return {
        verified: true,
        recipient,
        amount,
        symbol: known?.symbol, // undefined for unknown token -> label by target
        target: to,
      };
    }
  } catch {
    // fall through to unverified
  }

  // Unrecognised method / undecodable calldata: warn, never summarise friendly.
  return {
    verified: false,
    recipient: to ?? '(unknown)',
    target: to,
    selector: selectorOf(call.data),
  };
}

/**
 * Build the confirm Alert message from a derived summary. Verified transfers
 *  get a "Send <amount> <symbol> to <recipient>" line; unverified calls get an
 *  explicit warning naming the raw target + selector so the user can't be lulled
 *  by a spoofed metadata summary.
 */
export function confirmMessage(s: ConfirmSummary, chainName: string): string {
  if (s.verified) {
    const amountPart = s.amount != null
      ? `${s.amount}${s.symbol ? ` ${s.symbol}` : ''}`
      : 'tokens';
    const tokenNote = s.symbol ? '' : s.target ? `\nToken contract: ${s.target}` : '';
    return `Send ${amountPart} to ${s.recipient} on ${chainName}?${tokenNote}`;
  }
  const sel = s.selector ? `\nMethod: ${s.selector}` : '';
  return `⚠️ Unverified call to ${s.target ?? '(unknown)'} on ${chainName}.${sel}\nThe app could not confirm what this transaction does. Only continue if you fully trust the sender.`;
}
