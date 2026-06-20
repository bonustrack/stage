/** @file Metro in-chat transaction content types (wire shapes, ids, fallback text) shared by RN app, web client, and daemon, re-declaring the official XMTP walletSendCalls/transactionReference types because the npm codecs are shape-incompatible with the RN SDK's JSContentCodec; payment is a two-message WalletSendCalls request + TransactionReference receipt handshake. */

/** WalletSendCalls — `xmtp.org/walletSendCalls:1.0`. */

/** Optional per-call metadata. `description` is shown on the request card; `transactionType` is a free-form hint (e.g. `transfer`). */
export interface WalletSendCallMetadata {
  description?: string;
  transactionType?: string;
  /** Hints used to render the amount nicely on the card without re-decoding `data`. All optional — a vanilla wallet_sendCalls has none of these. */
  currency?: string;
  amount?: number;
  decimals?: number;
  toAddress?: string;
  [k: string]: unknown;
}

/** One EIP-5792 call with 0x-hex `to`/`data`/`value` (value is hex wei): native transfer sets to=recipient + value, ERC-20 sets to=token, value=0x0, data=encoded transfer(recipient,amount). */
export interface WalletSendCall {
  to?: string;
  data?: string;
  /** Hex wei, e.g. `0x2386f26fc10000` for 0.01 ETH. */
  value?: string;
  /** Per-chain gas hint, hex. Rarely set — wallets estimate. */
  gas?: string;
  metadata?: WalletSendCallMetadata;
}

export interface WalletSendCallsContent {
  version: string;
  /** Hex chain id, e.g. `0x1` for mainnet. NOT a decimal number. */
  chainId: string;
  /** Sender (the wallet expected to sign), 0x address. */
  from: string;
  calls: WalletSendCall[];
}

export const WALLET_SEND_CALLS_TYPE_ID = 'xmtp.org/walletSendCalls:1.0';
export const WALLET_SEND_CALLS_TYPE_SHORT = 'walletSendCalls';

/** TransactionReference — `xmtp.org/transactionReference:1.0`. */

export interface TransactionMetadata {
  transactionType?: string;
  currency?: string;
  /** Human amount in whole units (decimal), e.g. 0.01 — display only. */
  amount?: number;
  decimals?: number;
  fromAddress?: string;
  toAddress?: string;
  [k: string]: unknown;
}

export interface TransactionReferenceContent {
  /** Chain id — number or hex/decimal string per the spec; we emit a decimal number (mainnet = 1) but tolerate strings on decode. */
  networkId: number | string;
  /** The broadcast transaction hash (0x…64). */
  reference: string;
  metadata?: TransactionMetadata;
}

export const TRANSACTION_REFERENCE_TYPE_ID = 'xmtp.org/transactionReference:1.0';
export const TRANSACTION_REFERENCE_TYPE_SHORT = 'transactionReference';

/** Fallbacks + helpers (pure, shared by RN + daemon codecs and previews). */

/** Plain-text fallback for a WalletSendCalls (vanilla XMTP clients show this instead of a blank bubble). */
export function walletSendCallsFallbackText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `[Transaction request] ${desc}` : '[Transaction request]';
}

/** Plain-text fallback for a TransactionReference. */
export function transactionReferenceFallbackText(c: TransactionReferenceContent): string {
  return c?.reference ? `[Transaction] ${c.reference}` : '[Transaction]';
}

/** One-line preview for the channels list / daemon preview. */
export function walletSendCallsPreviewText(c: WalletSendCallsContent): string {
  const desc = c.calls?.[0]?.metadata?.description;
  return desc ? `Payment request: ${desc}` : 'Payment request';
}
/** One-line channels-list preview for a TransactionReference receipt. */
export function transactionReferencePreviewText(): string {
  return 'Transaction';
}

/** Decimal chain id from a hex (`0x1`) or decimal (`1`/`"1"`) form. */
export function chainIdToNumber(chainId: string | number): number {
  if (typeof chainId === 'number') return chainId;
  return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
}

/** Block-explorer base URL for a chain id (hex/decimal/number). Falls back to Etherscan mainnet. Covers the chains the wallet Send screen offers. */
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
