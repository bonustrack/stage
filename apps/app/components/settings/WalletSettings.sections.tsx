
import { Text } from '@stage-labs/kit/react-native/text';
import { Card } from '@stage-labs/kit/react-native/card';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type {
  ListViewItemNode,
  ListViewNode,
  PayloadHandlers,
} from '@stage-labs/kit/kit';
import {
  walletCopyRow,
  walletDeployRow,
  walletInfoRow,
  walletManageNode,
  walletModuleRow,
  SETTINGS_ACTION_PRESS,
  SETTINGS_COPY,
} from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { type DeployState, type useWalletModel } from './WalletSettings.parts';
import { type useEnablePasskey } from '../../lib/useEnablePasskey';
import { type useRemovePasskey } from '../../lib/useRemovePasskey';

export interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;
type Passkey = ReturnType<typeof useEnablePasskey>;
type RemovePasskey = ReturnType<typeof useRemovePasskey>;

export type CardFn = (node: ListViewNode) => React.ReactElement;

export function makeCard(
  dark: boolean, rowBg: string, blockRadius: number, actions: PayloadHandlers,
): CardFn {
  return (node) => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={rowBg} padding={0}>
        <ViewHost node={node} actions={actions}/>
      </Card>
    </Box>
  );
}

export function buildWalletActions({ onCopy, onRecovery, passkey, removePasskey }: {
  onCopy: (label: string, value: string) => void;
  onRecovery: () => void;
  passkey: Passkey;
  removePasskey: RemovePasskey;
}): PayloadHandlers {
  return {
    [SETTINGS_COPY]: (payload) => {
      const label = payload.label;
      const value = payload.value;
      if (typeof label === 'string' && typeof value === 'string') onCopy(label, value);
    },
    [SETTINGS_ACTION_PRESS]: (payload) => {
      const a = payload.action;
      if (a === 'recovery') onRecovery();
      else if (a === 'passkey') { if (!passkey.busy) passkey.run(); }
      else if (a === 'removePasskey') { if (!removePasskey.busy) removePasskey.run(); }
    },
  };
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
  const identityRows: ListViewItemNode[] = [walletCopyRow('XMTP identity', model.xmtpAddress)];
  if (model.ownerAddress) identityRows.push(walletCopyRow('Owner / recovery key (EOA)', model.ownerAddress));
  return (
    <>
      <SectionLabel>DEPLOY STATUS</SectionLabel>
      {card({ type: 'ListView', children: [walletDeployRow(deploy)] })}

      <SectionLabel>MODULES / VALIDATORS</SectionLabel>
      {card({
        type: 'ListView',
        children: model.modules.map((m) => walletModuleRow(m.name, m.role, m.status)),
      })}

      <SectionLabel>IDENTITY</SectionLabel>
      {card({ type: 'ListView', children: identityRows })}

      <SectionLabel>NETWORK</SectionLabel>
      {card({
        type: 'ListView',
        children: [
          walletInfoRow('Chain', `Base (${model.chainId})`),
          walletInfoRow('Kernel', `v${model.kernelVersion}`),
          walletInfoRow('EntryPoint', `v${model.entryPointVersion}`),
        ],
      })}

      <SectionLabel>MANAGE</SectionLabel>
      {card(walletManageNode(passkey, removePasskey, model.guardianCount))}
    </>
  );
}
