import type { BadgeColor } from '@stage-labs/kit/badge';

export type WalletModuleRole = 'sudo' | 'backup' | 'recovery' | 'session';

export type WalletDeployState = 'loading' | 'deployed' | 'counterfactual' | 'unknown';

export interface WalletPasskeyAction {
  available: boolean;
  busy: boolean;
}

export interface WalletAccountModel {
  label: string;
  hdIndex: number | null;
  isSmart: boolean;
  rec: { type: string };
  activeSigner: string;
}

export const WALLET_ROLE_BADGE: Record<WalletModuleRole, BadgeColor> = {
  sudo: 'success', backup: 'secondary', recovery: 'info', session: 'secondary',
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

export type WalletManageAction = 'passkey' | 'removePasskey' | 'recovery';

export interface WalletManageItem {
  icon: string;
  label: string;
  action: WalletManageAction;
}

export function walletManageItems(
  passkey: WalletPasskeyAction,
  removePasskey: WalletPasskeyAction,
  guardianCount: number | undefined,
): WalletManageItem[] {
  const items: WalletManageItem[] = [];
  if (passkey.available) {
    items.push({
      icon: 'fingerPrint',
      label: passkey.busy ? 'Enabling passkey…' : 'Enable passkey for signing',
      action: 'passkey',
    });
  }
  if (removePasskey.available) {
    items.push({
      icon: 'fingerPrint',
      label: removePasskey.busy ? 'Removing passkey…' : 'Remove passkey',
      action: 'removePasskey',
    });
  }
  items.push({
    icon: 'userGroup',
    label: guardianCount ? 'Guardian recovery & backup phrase' : 'Set up recovery & backup phrase',
    action: 'recovery',
  });
  return items;
}
