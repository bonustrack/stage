import { useQuery } from '@tanstack/react-query';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { KERNEL_VERSION_STRING, ENTRY_POINT_VERSION, SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import { walletAccountRows, walletDeployLabel, type WalletDeployState } from './WalletSettings.model';
import type { AccountRecord } from '../../lib/accounts';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { makePublicClient } from '../../lib/zerodev/client';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { AppIcon } from '../widgets';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { Column, Row } from '../layout';

interface WalletModel {
  rec: AccountRecord;
  isSmart: boolean;
  address: string;
  label: string;
  hdIndex: number | null;
  activeSigner: 'Recovery key';
  ownerAddress: string | null;
}

function modelFromRecord(rec: AccountRecord): WalletModel {
  const isSmart = rec.type === 'smart';
  return {
    rec,
    isSmart,
    address: rec.address,
    label: rec.label ?? 'Account',
    hdIndex: rec.hdIndex ?? null,
    activeSigner: 'Recovery key',
    ownerAddress: rec.ownerAddress ?? null,
  };
}

async function fetchDeployState(rec: AccountRecord): Promise<WalletDeployState> {
  if (rec.type !== 'smart') return 'unknown';
  try {
    const code = await makePublicClient().getCode({ address: rec.address as `0x${string}` });
    return code && code !== '0x' ? 'deployed' : 'counterfactual';
  } catch {
    return 'unknown';
  }
}

function useWalletModel(): { model: WalletModel | null; deploy: WalletDeployState } {
  const rec = useActiveAccountRecord();
  const { data: deploy } = useQuery({
    queryKey: ['walletDeployState', rec?.id ?? '', rec?.address ?? ''],
    queryFn: () => (rec ? fetchDeployState(rec) : Promise.resolve<WalletDeployState>('unknown')),
    enabled: !!rec,
    staleTime: 60_000,
  });
  return { model: rec ? modelFromRecord(rec) : null, deploy: deploy ?? 'loading' };
}

function WalletInfoRow({ label, value }: {
  label: string;
  value: string;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark}>
      <Column weight={1}>
        <Text text={label} size="xs" color="secondary" />
      </Column>
      <Text text={value} size="xs" color="text" />
    </ListViewItem>
  );
}

function WalletCopyRow({ label, value, onCopy }: {
  label: string;
  value: string;
  onCopy: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="start" gap={12} dark={dark} onPress={onCopy}>
      <Column weight={1} gap={4}>
        <Text text={label} size="3xs" color="secondary" />
        <Text text={value} size="xs" color="text" />
      </Column>
      <AppIcon name={IconSquareBehindSquare1} color="link" size={16} />
    </ListViewItem>
  );
}

function WalletValidatorRow(): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="start" gap={12} dark={dark}>
      <Column weight={1} gap={3}>
        <Row align="center" gap={8}>
          <Text text="ECDSA owner key" size="xs" color="text" />
          <Badge label="SUDO" color="success" pill={false} />
        </Row>
        <Text text="Main key (recovery phrase)" size="3xs" color="secondary" />
      </Column>
    </ListViewItem>
  );
}

function SmartAccountSections({ model }: { model: WalletModel }): React.ReactElement {
  const owner = model.ownerAddress;
  return (
    <>
      <SettingsGroup title="Validators">
        <WalletValidatorRow />
      </SettingsGroup>

      <SettingsGroup title="Identity">
        <WalletCopyRow label="XMTP identity" value={model.address} onCopy={() => { capabilities.copy('XMTP identity', model.address); }} />
        {owner ? <WalletCopyRow label="Owner key" value={owner} onCopy={() => { capabilities.copy('Owner key', owner); }} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Network">
        <WalletInfoRow label="Chain" value={`Base (${SCW_CHAIN_ID})`} />
        <WalletInfoRow label="Kernel" value={`v${KERNEL_VERSION_STRING}`} />
        <WalletInfoRow label="EntryPoint" value={`v${ENTRY_POINT_VERSION}`} />
      </SettingsGroup>
    </>
  );
}

export function WalletSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const { model, deploy } = useWalletModel();

  return (
    <SettingsPage title="Wallet">
      {!model ? (
        <Text size="xs" color={fg} style={{ padding: 24 }}>No active account.</Text>
      ) : (
        <>
          <SettingsGroup title="Address" footnote={model.isSmart ? 'Your smart account on Base. Tap to copy.' : 'Tap to copy.'}>
            <WalletCopyRow
              label={model.isSmart ? 'Smart account' : 'Address'}
              value={model.address}
              onCopy={() => { capabilities.copy('Address', model.address); }}
            />
          </SettingsGroup>

          <SettingsGroup title="Account">
            {walletAccountRows(model).map((row) => (
              <WalletInfoRow key={row.label} label={row.label} value={row.value} />
            ))}
            {model.isSmart ? <WalletInfoRow label="Status" value={walletDeployLabel(deploy)} /> : null}
          </SettingsGroup>

          {model.isSmart ? <SmartAccountSections model={model} /> : null}
        </>
      )}
    </SettingsPage>
  );
}
