

export interface WalletSendCallMetadata {
  description?: string;
  transactionType?: string;
  currency?: string;
  amount?: number;
  decimals?: number;
  toAddress?: string;
  [k: string]: unknown;
}

export interface WalletSendCall {
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  metadata?: WalletSendCallMetadata;
}

export interface WalletSendCallsContent {
  version: string;
  chainId: string;
  from: string;
  calls: WalletSendCall[];
}

export const WALLET_SEND_CALLS_TYPE_ID = 'xmtp.org/walletSendCalls:1.0';
export const WALLET_SEND_CALLS_TYPE_SHORT = 'walletSendCalls';


export interface TransactionMetadata {
  transactionType?: string;
  currency?: string;
  amount?: number;
  decimals?: number;
  fromAddress?: string;
  toAddress?: string;
  [k: string]: unknown;
}

export interface TransactionReferenceContent {
  networkId: number | string;
  reference: string;
  metadata?: TransactionMetadata;
}

export const TRANSACTION_REFERENCE_TYPE_ID = 'xmtp.org/transactionReference:1.0';
export const TRANSACTION_REFERENCE_TYPE_SHORT = 'transactionReference';


export function walletSendCallsFallbackText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `[Transaction request] ${desc}` : '[Transaction request]';
}

export function transactionReferenceFallbackText(c: TransactionReferenceContent): string {
  return c?.reference ? `[Transaction] ${c.reference}` : '[Transaction]';
}

export function walletSendCallsPreviewText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `Payment request: ${desc}` : 'Payment request';
}
export function transactionReferencePreviewText(): string {
  return 'Transaction';
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
