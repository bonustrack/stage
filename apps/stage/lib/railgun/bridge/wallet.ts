import { sdk } from './sdk';

export interface WalletInfoResult {
  railgunWalletID: string;
  railgunAddress: string;
}

export interface BridgeBalanceRow {
  tokenAddress: string;
  amount: string;
}

export interface BalancesResult {
  walletId: string;
  networks: { mainnet: BridgeBalanceRow[]; sepolia: BridgeBalanceRow[] };
  scanning: boolean;
  scanDebug?: { t: number; chain: number; msg: string }[];
}

export async function walletInfo(params: {
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}): Promise<WalletInfoResult> {
  return sdk<WalletInfoResult>('createWallet', [params]);
}

export async function getBalances(walletId: string): Promise<BalancesResult> {
  return sdk<BalancesResult>('balances', [{ walletId }]);
}
