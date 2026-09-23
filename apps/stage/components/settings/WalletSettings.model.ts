import type { BadgeColor } from '@stage-labs/kit/badge';

export type WalletModuleRole = 'sudo' | 'backup' | 'session';

export type WalletDeployState = 'loading' | 'deployed' | 'counterfactual' | 'unknown';

export interface WalletAccountModel {
  label: string;
  hdIndex: number | null;
  isSmart: boolean;
  rec: { type: string };
  activeSigner: string;
}

export const WALLET_ROLE_BADGE: Record<WalletModuleRole, BadgeColor> = {
  sudo: 'success', backup: 'secondary', session: 'secondary',
};

export function walletDeployLabel(d: WalletDeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

export interface WalletValueRow {
  label: string;
  value: string;
}

export function walletAccountRows(model: WalletAccountModel): WalletValueRow[] {
  const rows: WalletValueRow[] = [{ label: 'Name', value: model.label }];
  if (model.hdIndex != null) rows.push({ label: 'HD index', value: `#${model.hdIndex}` });
  rows.push({
    label: 'Type',
    value: model.isSmart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${model.rec.type})`,
  });
  if (model.isSmart) rows.push({ label: 'Active signer', value: model.activeSigner });
  return rows;
}

export const WALLET_SECURITY_LINK = {
  label: 'Passkey, backup and devices',
  icon: 'key',
  href: '/settings/security',
} as const;
