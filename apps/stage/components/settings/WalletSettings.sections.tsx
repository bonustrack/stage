
import type { ReactElement, ReactNode } from 'react';
import { resolveBadgeStyle } from '@stage-labs/kit/kit';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import {
  WALLET_ROLE_BADGE,
  walletDeployLabel,
  walletManageItems,
  type WalletDeployState,
  type WalletManageAction,
  type WalletModuleRole,
  type WalletPasskeyAction,
} from '@views';
import { Box, Col, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { type DeployState, type useWalletModel } from './WalletSettings.parts';
import { type useEnablePasskey } from '../../lib/useEnablePasskey';
import { type useRemovePasskey } from '../../lib/useRemovePasskey';
import { SettingsIcon, SettingsList } from './rows';

export interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;
type Passkey = ReturnType<typeof useEnablePasskey>;
type RemovePasskey = ReturnType<typeof useRemovePasskey>;

export type CardFn = (children: ReactNode) => ReactElement;

export function makeCard(dark: boolean, rowBg: string, blockRadius: number): CardFn {
  return (children) => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={rowBg} padding={0}>
        {children}
      </Card>
    </Box>
  );
}

export function SectionLabel({ children }: { children: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Text size="xs" color={fg} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

export function WalletInfoRow({ label, value }: {
  label: string;
  value: string;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark}>
      <Col flex={1}>
        <Text value={label} size="md" color="secondary" />
      </Col>
      <Text value={value} size="md" color="text" />
    </ListViewItem>
  );
}

export function WalletCopyRow({ label, value, onCopy }: {
  label: string;
  value: string;
  onCopy: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="start" gap={12} dark={dark} onPress={onCopy}>
      <Col flex={1} gap={4}>
        <Text value={label} size="xs" color="secondary" />
        <Text value={value} size="md" color="text" />
      </Col>
      <SettingsIcon name="copy" color="link" size={16} />
    </ListViewItem>
  );
}

function RoleBadge({ role }: { role: WalletModuleRole }): React.ReactElement {
  const scheme = useKitScheme();
  const styled = resolveBadgeStyle(WALLET_ROLE_BADGE[role], undefined, 'sm', scheme);
  return (
    <Box
      direction="row"
      align="center"
      padding={{ x: 8, y: 2 }}
      radius="sm"
      background={styled.background}
    >
      <Text
        value={role.toUpperCase()}
        size={styled.fontToken}
        weight="semibold"
        color={styled.foreground}
      />
    </Box>
  );
}

function WalletModuleRow({ name, role, status }: {
  name: string;
  role: WalletModuleRole;
  status: string;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="start" gap={12} dark={dark}>
      <Col flex={1} gap={3}>
        <Row align="center" gap={8}>
          <Text value={name} size="md" color="text" />
          <RoleBadge role={role} />
        </Row>
        <Text value={status} size="xs" color="secondary" />
      </Col>
    </ListViewItem>
  );
}

function WalletDeployRow({ deploy }: { deploy: WalletDeployState }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark}>
      <SettingsIcon
        name={deploy === 'deployed' ? 'checkCircle' : 'clock'}
        color={deploy === 'deployed' ? 'link' : 'secondary'}
        size={24}
      />
      <Col flex={1}>
        <Text value={walletDeployLabel(deploy)} size="md" color="text" />
      </Col>
    </ListViewItem>
  );
}

function WalletManageList({ passkey, removePasskey, guardianCount, onAction }: {
  passkey: WalletPasskeyAction;
  removePasskey: WalletPasskeyAction;
  guardianCount: number | undefined;
  onAction: (action: WalletManageAction) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <SettingsList>
      {walletManageItems(passkey, removePasskey, guardianCount).map((item) => (
        <ListViewItem
          key={item.action}
          align="center"
          gap={12}
          dark={dark}
          onPress={() => { onAction(item.action); }}
        >
          <SettingsIcon name={item.icon} color="link" size={28} />
          <Col flex={1}>
            <Text value={item.label} size="md" color="text" />
          </Col>
          <SettingsIcon name="chevronRight" color="link" size={24} />
        </ListViewItem>
      ))}
    </SettingsList>
  );
}

export function SmartAccountSections({ model, deploy, card, passkey, removePasskey, onCopy, onRecovery }: {
  model: WalletModel;
  deploy: DeployState;
  card: CardFn;
  passkey: Passkey;
  removePasskey: RemovePasskey;
  onCopy: (label: string, value: string) => void;
  onRecovery: () => void;
}): React.ReactElement {
  const onManage = (action: WalletManageAction): void => {
    if (action === 'recovery') onRecovery();
    else if (action === 'passkey') { if (!passkey.busy) passkey.run(); }
    else if (!removePasskey.busy) removePasskey.run();
  };
  return (
    <>
      <SectionLabel>DEPLOY STATUS</SectionLabel>
      {card(
        <SettingsList>
          <WalletDeployRow deploy={deploy} />
        </SettingsList>,
      )}

      <SectionLabel>MODULES / VALIDATORS</SectionLabel>
      {card(
        <SettingsList>
          {model.modules.map((m) => (
            <WalletModuleRow key={m.name} name={m.name} role={m.role} status={m.status} />
          ))}
        </SettingsList>,
      )}

      <SectionLabel>IDENTITY</SectionLabel>
      {card(
        <SettingsList>
          <WalletCopyRow
            label="XMTP identity"
            value={model.xmtpAddress}
            onCopy={() => { onCopy('XMTP identity', model.xmtpAddress); }}
          />
          {model.ownerAddress ? (
            <WalletCopyRow
              label="Owner / recovery key (EOA)"
              value={model.ownerAddress}
              onCopy={() => {
                if (model.ownerAddress) onCopy('Owner / recovery key (EOA)', model.ownerAddress);
              }}
            />
          ) : null}
        </SettingsList>,
      )}

      <SectionLabel>NETWORK</SectionLabel>
      {card(
        <SettingsList>
          <WalletInfoRow label="Chain" value={`Base (${model.chainId})`} />
          <WalletInfoRow label="Kernel" value={`v${model.kernelVersion}`} />
          <WalletInfoRow label="EntryPoint" value={`v${model.entryPointVersion}`} />
        </SettingsList>,
      )}

      <SectionLabel>MANAGE</SectionLabel>
      {card(
        <WalletManageList
          passkey={passkey}
          removePasskey={removePasskey}
          guardianCount={model.guardianCount}
          onAction={onManage}
        />,
      )}
    </>
  );
}
