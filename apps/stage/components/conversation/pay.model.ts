import { base } from 'viem/chains';

export interface PaymentCheck {
  callCount: number;
  chainId: number;
  chainName: string;
  smartAccount: boolean;
}

export function paymentBlocker(check: PaymentCheck): string | null {
  if (check.callCount !== 1) return 'This payment has several steps. Stage can only pay single-step requests.';
  if (check.smartAccount && check.chainId !== base.id) {
    return `This payment is on ${check.chainName}. Your Stage wallet pays on Base only.`;
  }
  return null;
}
