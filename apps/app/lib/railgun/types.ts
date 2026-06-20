
export interface PrivateBalance {
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  logoUrl: string;
}

export interface PrivateSnapshot {
  zkAddress: string;
  balances: PrivateBalance[];
  updatedAt: number;
  scanning?: boolean;
}

export interface PendingAction {
  id: string;
  kind: 'shield' | 'send' | 'unshield';
  symbol: string;
  chainId: number;
  delta: string;
  phase: 'proving' | 'broadcasting' | 'scanning' | 'confirmed' | 'failed';
  txHash?: string;
  error?: string;
  startedAt: number;
}
