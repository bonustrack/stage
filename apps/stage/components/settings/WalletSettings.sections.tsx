
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import {
  WALLET_ROLE_BADGE,
  walletDeployLabel,
  type WalletDeployState,
  type WalletModuleRole,
} from './WalletSettings.model';
import { Col, Row } from '../layout';
import { SettingsCard, SettingsSectionLabel } from './SettingsPage';
import type { useWalletModel } from './WalletSettings.parts';
import { SettingsList } from './rows';
import { AppIcon } from '../widgets';
import { Badge } from '@stage-labs/kit/react-native/badge';

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;

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
      <AppIcon name="copy" color="link" size={16} />
    </ListViewItem>
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
          <Badge label={role.toUpperCase()} color={WALLET_ROLE_BADGE[role]} />
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
      <AppIcon
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

export function SmartAccountSections({ model, deploy, onCopy }: {
  model: WalletModel;
  deploy: WalletDeployState;
  onCopy: (label: string, value: string) => void;
}): React.ReactElement {
  return (
    <>
      <SettingsSectionLabel>DEPLOY STATUS</SettingsSectionLabel>
      <SettingsCard>
        <SettingsList>
          <WalletDeployRow deploy={deploy} />
        </SettingsList>
      </SettingsCard>

      <SettingsSectionLabel>MODULES / VALIDATORS</SettingsSectionLabel>
      <SettingsCard>
        <SettingsList>
          {model.modules.map((m) => (
            <WalletModuleRow key={m.name} name={m.name} role={m.role} status={m.status} />
          ))}
        </SettingsList>
      </SettingsCard>

      <SettingsSectionLabel>IDENTITY</SettingsSectionLabel>
      <SettingsCard>
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
        </SettingsList>
      </SettingsCard>

      <SettingsSectionLabel>NETWORK</SettingsSectionLabel>
      <SettingsCard>
        <SettingsList>
          <WalletInfoRow label="Chain" value={`Base (${model.chainId})`} />
          <WalletInfoRow label="Kernel" value={`v${model.kernelVersion}`} />
          <WalletInfoRow label="EntryPoint" value={`v${model.entryPointVersion}`} />
        </SettingsList>
      </SettingsCard>
    </>
  );
}
