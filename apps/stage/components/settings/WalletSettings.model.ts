import type { AccountRecord } from '@stage-labs/client/accounts/types';

export type WalletDeployState = 'loading' | 'deployed' | 'counterfactual' | 'unknown';

const ACTIVE_SIGNER = 'Recovery key';

export function walletDeployLabel(d: WalletDeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

interface WalletValueRow {
  label: string;
  value: string;
}

export function walletAccountRows(rec: Pick<AccountRecord, 'type' | 'label' | 'hdIndex'>): WalletValueRow[] {
  const smart = rec.type === 'smart';
  const rows: WalletValueRow[] = [{ label: 'Name', value: rec.label ?? 'Account' }];
  if (rec.hdIndex != null) rows.push({ label: 'HD index', value: `#${rec.hdIndex}` });
  rows.push({ label: 'Type', value: smart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${rec.type})` });
  if (smart) rows.push({ label: 'Active signer', value: ACTIVE_SIGNER });
  return rows;
}
