import { isAddress, erc20Abi, encodeFunctionData, parseUnits, formatUnits, type Hex } from 'viem';
import type { Asset } from './assets';

export interface PublicSendCall {
  to: Hex;
  value: bigint;
  data?: Hex;
}

export function parseSendAmount(amount: string, decimals: number): bigint {
  const trimmed = typeof amount === 'string' ? amount.trim() : '';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Invalid amount');
  const frac = trimmed.split('.')[1] ?? '';
  if (frac.length > decimals) throw new Error('Invalid amount');
  let value: bigint;
  try {
    value = parseUnits(trimmed, decimals);
  } catch {
    throw new Error('Invalid amount');
  }
  if (value <= 0n) throw new Error('Invalid amount');
  return value;
}

export function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

export type RecipientClassification =
  | { kind: 'empty' }
  | { kind: 'address'; resolved: string }
  | { kind: 'invalid' }
  | { kind: 'ens'; query: string };

export function classifyRecipientInput(raw: string): RecipientClassification {
  const q = raw.trim();
  if (!q) return { kind: 'empty' };
  if (isAddress(q)) return { kind: 'address', resolved: q.toLowerCase() };
  if (!looksLikeEns(q)) return { kind: 'invalid' };
  return { kind: 'ens', query: q.toLowerCase() };
}

export function noAddressSetError(query: string): string {
  return `No address set for ${query}`;
}

export interface SendFeePreview {
  feeWei: bigint;
  feeEth: string;
  sponsored?: boolean;
}

export interface FeeEstimateInputs {
  gas: bigint;
  maxFeePerGas?: bigint | null;
  gasPrice?: bigint | null;
}

export function publicSendFee({ gas, maxFeePerGas, gasPrice }: FeeEstimateInputs): SendFeePreview {
  const perGas = maxFeePerGas ?? gasPrice ?? 0n;
  const feeWei = gas * perGas;
  return { feeWei, feeEth: formatUnits(feeWei, 18) };
}

export interface BuildTransferArgs {
  recipient: string;
  amount: string;
  asset: Pick<Asset, 'address' | 'decimals'>;
}

export function buildPublicTransfer({ recipient, amount, asset }: BuildTransferArgs): PublicSendCall {
  if (!isAddress(recipient)) throw new Error('Invalid recipient address');
  const value = parseSendAmount(amount, asset.address ? asset.decimals : 18);
  if (asset.address) {
    return {
      to: asset.address,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, value] }),
    };
  }
  return { to: recipient, value };
}
