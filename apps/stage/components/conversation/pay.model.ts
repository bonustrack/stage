import { isWalletChain, WALLET_CHAIN_ONLY } from '@stage-labs/client/wallet/chains';

export interface PaymentCheck {
  callCount: number;
  chainId: number;
  chainName: string;
  smartAccount: boolean;
}

export function paymentBlocker(check: PaymentCheck): string | null {
  if (check.callCount !== 1) return 'This payment has several steps. Stage can only pay single-step requests.';
  if (check.smartAccount && !isWalletChain(check.chainId)) return `This payment is on ${check.chainName}. ${WALLET_CHAIN_ONLY}`;
  return null;
}
