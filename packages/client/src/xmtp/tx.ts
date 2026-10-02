import { formatUnits } from 'viem';
import { deriveConfirmSummary } from '../wallet/txConfirm';
import type { WalletSendCallsContent, TransactionReferenceContent } from './tx.schema';

export type { WalletSendCallsContent, TransactionReferenceContent } from './tx.schema';

export function walletSendCallsFallbackText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `[Transaction request] ${desc}` : '[Transaction request]';
}

export function transactionReferenceFallbackText(c: TransactionReferenceContent): string {
  return c?.reference ? `[Transaction] ${c.reference}` : '[Transaction]';
}

export interface TxAmount { value: string; unit: string }

interface AmountMeta { amount?: number; decimals?: number; currency?: string }

const MAX_DECIMALS = 77;

function scaledAmount(amount: number, decimals: number | undefined): string {
  const atomic = decimals !== undefined && Number.isInteger(amount) && Number.isInteger(decimals)
    && decimals > 0 && decimals <= MAX_DECIMALS;
  return atomic ? formatUnits(BigInt(amount), decimals) : String(amount);
}

function metaAmountOf(meta: AmountMeta | undefined): TxAmount | undefined {
  const { amount, decimals, currency } = meta ?? {};
  if (amount == null || !Number.isFinite(amount)) return undefined;
  return { value: scaledAmount(amount, decimals), unit: currency ?? 'ETH' };
}

type Call = WalletSendCallsContent['calls'][number];

function isBareCall(call: Call): boolean {
  return call.value === undefined && (call.data === undefined || call.data === '0x');
}

function verifiedAmountOf(call: Call): TxAmount | undefined {
  if (isBareCall(call)) return undefined;
  const summary = deriveConfirmSummary(call);
  if (!summary.verified || summary.amount == null || !summary.symbol) return undefined;
  return { value: summary.amount, unit: summary.symbol };
}

export function requestAmountOf(req: WalletSendCallsContent | null | undefined): TxAmount | undefined {
  const call = req?.calls?.[0];
  if (!call) return undefined;
  return verifiedAmountOf(call) ?? metaAmountOf(call.metadata);
}

function receiptAmountOf(receipt: TransactionReferenceContent | null | undefined): TxAmount | undefined {
  return metaAmountOf(receipt?.metadata);
}

export function txAmountLabel(amount: TxAmount | undefined): string | undefined {
  return amount ? `${amount.value} ${amount.unit}` : undefined;
}

export function paymentRequestPreview(req: WalletSendCallsContent | null | undefined): string {
  const label = txAmountLabel(requestAmountOf(req));
  return label ? `Payment request: ${label}` : 'Payment request';
}

export function receiptTitle(receipt: TransactionReferenceContent | null | undefined): string {
  const label = txAmountLabel(receiptAmountOf(receipt));
  return label ? `Payment sent · ${label}` : 'Transaction sent';
}

export function chainIdToNumber(chainId: string | number): number {
  if (typeof chainId === 'number') return chainId;
  return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
}

export function explorerTxUrl(chainId: string | number, txHash: string): string {
  const id = chainIdToNumber(chainId);
  const base: Record<number, string> = {
    1: 'https://etherscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    11155111: 'https://sepolia.etherscan.io',
  };
  return `${base[id] ?? 'https://etherscan.io'}/tx/${txHash}`;
}
