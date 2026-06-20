
import { decodeFunctionData, formatEther, formatUnits, isAddress, type Hex } from 'viem';

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

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 },
};

export interface ConfirmSummary {
  verified: boolean;
  recipient: string;
  amount?: string;
  symbol?: string;
  target?: string;
  selector?: string;
}

interface CallLike {
  to?: string;
  data?: string;
  value?: string;
}

function selectorOf(data?: string): string | undefined {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return undefined;
  return data.slice(0, 10).toLowerCase();
}

function parseWei(value?: string): bigint | null {
  try { return BigInt(value ?? '0x0'); } catch { return null; }
}

function deriveNativeSummary(
  to: string | undefined, value: string | undefined, nativeSymbol: string,
): ConfirmSummary {
  const wei = parseWei(value);
  if (to && isAddress(to) && wei !== null) {
    return { verified: true, recipient: to, amount: formatEther(wei), symbol: nativeSymbol };
  }
  return { verified: false, recipient: to ?? '(unknown)', target: to, selector: undefined };
}

function deriveTransferSummary(
  to: string | undefined, data: string,
): ConfirmSummary | undefined {
  try {
    const decoded = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: data as Hex });
    if (decoded.functionName !== 'transfer') return undefined;
    const [recipient, rawAmount] = decoded.args as readonly [string, bigint];
    const known = KNOWN_TOKENS[(to ?? '').toLowerCase()];
    const amount = known
      ? formatUnits(rawAmount, known.decimals)
      : rawAmount.toString();
    return {
      verified: true,
      recipient,
      amount,
      symbol: known?.symbol,
      target: to,
    };
  } catch {
    return undefined;
  }
}

export function deriveConfirmSummary(
  call: CallLike,
  nativeSymbol = 'ETH',
): ConfirmSummary {
  const to = call.to;
  const data = call.data;
  const hasData = !!data && data !== '0x' && data.length > 2;

  if (!hasData) return deriveNativeSummary(to, call.value, nativeSymbol);

  const transfer = deriveTransferSummary(to, data);
  if (transfer) return transfer;

  return { verified: false, recipient: to ?? '(unknown)', target: to, selector: selectorOf(call.data) };
}

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
