
import { Text } from '@stage-labs/kit/react-native/text';
import { Card } from '@stage-labs/kit/react-native/card';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type {
  BadgeColor,
  ListViewItemNode,
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/kit';
import {
  badge,
  col,
  icon,
  row,
  text,
  SETTINGS_ACTION_PRESS,
  SETTINGS_COPY,
} from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { type DeployState, type ModuleRole, type useWalletModel } from './WalletSettings.parts';
import { type useEnablePasskey } from '../../lib/useEnablePasskey';
import { type useRemovePasskey } from '../../lib/useRemovePasskey';

export interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;
type Passkey = ReturnType<typeof useEnablePasskey>;
type RemovePasskey = ReturnType<typeof useRemovePasskey>;

const ROLE_COLOR: Record<ModuleRole, BadgeColor> = {
  sudo: 'success', backup: 'secondary', recovery: 'info', session: 'secondary',
};

function infoRow(label: string, value: string): ListViewItemNode {
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

function copyRow(label: string, value: string): ListViewItemNode {
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

function moduleRow(name: string, role: ModuleRole, status: string): ListViewItemNode {
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

function deployLabel(d: DeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

function deployRow(deploy: DeployState): ListViewItemNode {
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

function manageNode(
  passkey: Passkey, removePasskey: RemovePasskey, guardianCount: number | undefined,
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

export type CardFn = (node: ListViewNode) => React.ReactElement;

export function makeCard(
  dark: boolean, rowBg: string, blockRadius: number, registry: WidgetActionRegistry,
): CardFn {
  return (node) => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={rowBg} padding={0}>
        <KitRenderer node={node} registry={registry}/>
      </Card>
    </Box>
  );
}

export function buildWalletRegistry({ onCopy, onRecovery, passkey, removePasskey }: {
  onCopy: (label: string, value: string) => void;
  onRecovery: () => void;
  passkey: Passkey;
  removePasskey: RemovePasskey;
}): WidgetActionRegistry {
  return {
    [SETTINGS_COPY]: (action) => {
      const label = action.payload.label;
      const value = action.payload.value;
      if (typeof label === 'string' && typeof value === 'string') onCopy(label, value);
    },
    [SETTINGS_ACTION_PRESS]: (action) => {
      const a = action.payload.action;
      if (a === 'recovery') onRecovery();
      else if (a === 'passkey') { if (!passkey.busy) passkey.run(); }
      else if (a === 'removePasskey') { if (!removePasskey.busy) removePasskey.run(); }
    },
  };
}

export function accountNode(model: WalletModel): ListViewNode {
  const rows: ListViewItemNode[] = [infoRow('Name', model.label)];
  if (model.hdIndex != null) rows.push(infoRow('HD index', `#${model.hdIndex}`));
  rows.push(infoRow('Type',
    model.isSmart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${model.rec.type})`));
  if (model.isSmart) rows.push(infoRow('Active signer', model.activeSigner));
  return { type: 'ListView', children: rows };
}

export function addressNode(model: WalletModel): ListViewNode {
  return { type: 'ListView', children: [copyRow('Address', model.address)] };
}

export function SectionLabel({ children }: { children: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Text size="xs" color={fg} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

export function SmartAccountSections({ model, deploy, card, passkey, removePasskey }: {
  model: WalletModel; deploy: DeployState; card: CardFn; passkey: Passkey; removePasskey: RemovePasskey;
}): React.ReactElement {
  const identityRows: ListViewItemNode[] = [copyRow('XMTP identity', model.xmtpAddress)];
  if (model.ownerAddress) identityRows.push(copyRow('Owner / recovery key (EOA)', model.ownerAddress));
  return (
    <>
      <SectionLabel>DEPLOY STATUS</SectionLabel>
      {card({ type: 'ListView', children: [deployRow(deploy)] })}

      <SectionLabel>MODULES / VALIDATORS</SectionLabel>
      {card({
        type: 'ListView',
        children: model.modules.map((m) => moduleRow(m.name, m.role, m.status)),
      })}

      <SectionLabel>IDENTITY</SectionLabel>
      {card({ type: 'ListView', children: identityRows })}

      <SectionLabel>NETWORK</SectionLabel>
      {card({
        type: 'ListView',
        children: [
          infoRow('Chain', `Base (${model.chainId})`),
          infoRow('Kernel', `v${model.kernelVersion}`),
          infoRow('EntryPoint', `v${model.entryPointVersion}`),
        ],
      })}

      <SectionLabel>MANAGE</SectionLabel>
      {card(manageNode(passkey, removePasskey, model.guardianCount))}
    </>
  );
}
