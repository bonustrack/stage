import type { WalletSendCallsContent, TransactionReferenceContent } from './tx.schema';

export type { WalletSendCallsContent, TransactionReferenceContent } from './tx.schema';

export function walletSendCallsFallbackText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `[Transaction request] ${desc}` : '[Transaction request]';
}

export function transactionReferenceFallbackText(c: TransactionReferenceContent): string {
  return c?.reference ? `[Transaction] ${c.reference}` : '[Transaction]';
}

export function chainIdToNumber(chainId: string | number): number {
  if (typeof chainId === 'number') return chainId;
  return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
}

export interface NormalizedCall {
  to: `0x${string}`;
  value: bigint;
  data?: `0x${string}`;
}

export interface NormalizedSendCalls {
  chainId: number;
  calls: NormalizedCall[];
}

function isHexAddress(v: string | undefined): v is `0x${string}` {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
}

function isHexData(v: string): v is `0x${string}` {
  return /^0x[0-9a-fA-F]*$/.test(v);
}

function toBigInt(v: string | undefined): bigint {
  if (!v) return 0n;
  return BigInt(v);
}

export function normalizeWalletSendCalls(content: WalletSendCallsContent): NormalizedSendCalls {
  const chainId = chainIdToNumber(content.chainId);
  if (!Number.isFinite(chainId) || chainId <= 0) throw new Error('Transaction request has an invalid chain.');
  const raw = content.calls ?? [];
  if (raw.length === 0) throw new Error('Transaction request has no calls.');
  const calls: NormalizedCall[] = raw.map((c) => {
    if (!isHexAddress(c.to)) throw new Error('Transaction request has an invalid recipient address.');
    if (c.data != null && !isHexData(c.data)) throw new Error('Transaction request has invalid call data.');
    let value: bigint;
    try {
      value = toBigInt(c.value);
    } catch {
      throw new Error('Transaction request has an invalid value.');
    }
    return { to: c.to, value, ...(c.data ? { data: c.data } : {}) };
  });
  return { chainId, calls };
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
