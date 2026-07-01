import type {
  BadgeColor,
  ListViewItemNode,
  ListViewNode,
} from '@stage-labs/kit/kit';
import { badge, col, icon, row, text } from '../primitives';
import { SETTINGS_ACTION_PRESS, SETTINGS_COPY } from '../actions';

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

const ROLE_COLOR: Record<WalletModuleRole, BadgeColor> = {
  sudo: 'success', backup: 'secondary', recovery: 'info', session: 'secondary',
};

export function walletInfoRow(label: string, value: string): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      col([text(label, { size: 'md', color: 'secondary' })], { flex: 1 }),
      text(value, { size: 'md', color: 'text' }),
    ],
  };
}

export function walletCopyRow(label: string, value: string): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'start',
    gap: 12,
    onClickAction: { type: SETTINGS_COPY, payload: { label, value } },
    children: [
      col([
        text(label, { size: 'xs', color: 'secondary' }),
        text(value, { size: 'md', color: 'text' }),
      ], { flex: 1, gap: 4 }),
      icon('copy', { color: 'link', size: 'sm' }),
    ],
  };
}

export function walletModuleRow(name: string, role: WalletModuleRole, status: string): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'start',
    gap: 12,
    children: [
      col([
        row([
          text(name, { size: 'md', color: 'text' }),
          badge(role.toUpperCase(), { color: ROLE_COLOR[role], variant: 'soft', size: 'sm' }),
        ], { align: 'center', gap: 8 }),
        text(status, { size: 'xs', color: 'secondary' }),
      ], { flex: 1, gap: 3 }),
    ],
  };
}

function deployLabel(d: WalletDeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

export function walletDeployRow(deploy: WalletDeployState): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      icon(deploy === 'deployed' ? 'checkCircle' : 'clock', {
        color: deploy === 'deployed' ? 'link' : 'secondary', size: 'lg',
      }),
      col([text(deployLabel(deploy), { size: 'md', color: 'text' })], { flex: 1 }),
    ],
  };
}

function manageRow(iconName: string, label: string, action: string): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    onClickAction: { type: SETTINGS_ACTION_PRESS, payload: { action } },
    children: [
      icon(iconName, { color: 'link', size: 'xl' }),
      col([text(label, { size: 'md', color: 'text' })], { flex: 1 }),
      icon('chevronRight', { color: 'link', size: 'lg' }),
    ],
  };
}

export function walletManageNode(
  passkey: WalletPasskeyAction, removePasskey: WalletPasskeyAction, guardianCount: number | undefined,
): ListViewNode {
  const rows: ListViewItemNode[] = [];
  if (passkey.available) {
    rows.push(manageRow('fingerPrint', passkey.busy ? 'Enabling passkey…' : 'Enable passkey for signing', 'passkey'));
  }
  if (removePasskey.available) {
    rows.push(manageRow('fingerPrint', removePasskey.busy ? 'Removing passkey…' : 'Remove passkey', 'removePasskey'));
  }
  rows.push(manageRow('userGroup',
    guardianCount ? 'Guardian recovery & backup phrase' : 'Set up recovery & backup phrase', 'recovery'));
  return { type: 'ListView', children: rows };
}

export function walletAccountNode(model: WalletAccountModel): ListViewNode {
  const rows: ListViewItemNode[] = [walletInfoRow('Name', model.label)];
  if (model.hdIndex != null) rows.push(walletInfoRow('HD index', `#${model.hdIndex}`));
  rows.push(walletInfoRow('Type',
    model.isSmart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${model.rec.type})`));
  if (model.isSmart) rows.push(walletInfoRow('Active signer', model.activeSigner));
  return { type: 'ListView', children: rows };
}

export function walletAddressNode(model: { address: string }): ListViewNode {
  return { type: 'ListView', children: [walletCopyRow('Address', model.address)] };
}
