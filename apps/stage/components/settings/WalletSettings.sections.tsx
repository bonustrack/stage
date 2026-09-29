
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { WALLET_ROLE_BADGE, type WalletModuleRole } from './WalletSettings.model';
import { Col, Row } from '../layout';
import { SettingsGroup } from './SettingsPage';
import type { useWalletModel } from './WalletSettings.parts';
import { AppIcon } from '../widgets';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';

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
      <AppIcon name={IconSquareBehindSquare1} color="link" size={16} />
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

export function SmartAccountSections({ model, onCopy }: {
  model: WalletModel;
  onCopy: (label: string, value: string) => void;
}): React.ReactElement {
  const owner = model.ownerAddress;
  return (
    <>
      <SettingsGroup title="Validators">
        {model.modules.map((m) => (
          <WalletModuleRow key={m.name} name={m.name} role={m.role} status={m.status} />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Identity">
        <WalletCopyRow label="XMTP identity" value={model.xmtpAddress} onCopy={() => { onCopy('XMTP identity', model.xmtpAddress); }} />
        {owner ? <WalletCopyRow label="Owner key" value={owner} onCopy={() => { onCopy('Owner key', owner); }} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Network">
        <WalletInfoRow label="Chain" value={`Base (${model.chainId})`} />
        <WalletInfoRow label="Kernel" value={`v${model.kernelVersion}`} />
        <WalletInfoRow label="EntryPoint" value={`v${model.entryPointVersion}`} />
      </SettingsGroup>
    </>
  );
}
