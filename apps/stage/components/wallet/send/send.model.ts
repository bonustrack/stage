import { WALLET_ASSETS, type AssetRow } from '@stage-labs/client/wallet/assets';
import { WALLET_CHAIN_ID } from '@stage-labs/client/wallet/chains';
import { fmtLocalUsd, fmtTokenAmount } from '@stage-labs/client/wallet/format';
import type { AmountUnit } from '@stage-labs/client/wallet/sendAmount';

export type SendTxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

const USDC_PEG_USD = 1;

export function sendTokenFor(symbol?: string, chainId?: string): string {
  const cid = chainId ? Number(chainId) : WALLET_CHAIN_ID;
  return WALLET_ASSETS.find((a) => a.symbol === symbol && a.chainId === cid)?.symbol ?? 'ETH';
}

export function sendRowFor(rows: readonly AssetRow[], symbol: string): AssetRow | undefined {
  return rows.find((r) => r.symbol === symbol && r.chainId === WALLET_CHAIN_ID);
}

export function sendPriceUsd(symbol: string, row: Pick<AssetRow, 'priceUsd'> | undefined): number | null {
  if (symbol === 'USDC') return USDC_PEG_USD;
  return symbol === 'ETH' ? (row?.priceUsd ?? null) : null;
}

export function secondaryLabelOf(amount: string, unit: AmountUnit, priceUsd: number | null, symbol: string): string {
  if (!amount.trim() || !priceUsd) return '';
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) return '';
  if (unit === 'primary') return `≈ ${fmtLocalUsd(n * priceUsd, 2)}`;
  return `≈ ${fmtTokenAmount(n / priceUsd, 6)} ${symbol}`;
}

export function balanceLabelOf(balance: string | null, symbol: string): string | undefined {
  return balance ? `Balance: ${fmtTokenAmount(Number(balance), 6)} ${symbol}` : undefined;
}

export function unitLabelOf(unit: AmountUnit, symbol: string): string {
  return unit === 'primary' ? symbol : 'USD';
}

export function maxAmountOf(balance: string | null, unit: AmountUnit, priceUsd: number | null): string | null {
  if (!balance) return null;
  if (unit === 'primary') return balance;
  return priceUsd ? (Number(balance) * priceUsd).toFixed(2) : null;
}

export function submitLabelFor(txState: SendTxState, reviewing: boolean): string {
  if (txState === 'submitting') return 'Confirm in wallet…';
  if (txState === 'pending') return 'Sending…';
  if (txState === 'confirmed') return 'Sent ✓';
  return reviewing ? 'Send' : 'Review';
}
