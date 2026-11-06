import { useQuery } from '@tanstack/react-query';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { QrPanel } from '../../qr/QrPanel';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { capabilities } from '../../../lib/capabilities';
import { Eyebrow } from '../../Eyebrow';
import { StackHeader } from '../../chrome/StackHeader';
import { AppIcon } from '../../widgets';
import { getActiveAccount } from '../../../lib/accounts';
import { usePalette } from '../../../lib/theme';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { Text } from '@stage-labs/kit/react-native/text';
import { Column, ScreenScroll } from '../../layout';

const ADDRESS_LABEL = 'Wallet address (tap to copy)';
const ADDRESS_HINT =
  'Scan or share this address to receive ETH or tokens on Base. Funds sent on another network will not show up in your Stage wallet.';

const QR_SIZE = 240;
const QR_PLACEHOLDER_BACKGROUND = '#f4f4f5';

function AddressCard({ address, onCopy }: { address: string; onCopy: () => void }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <Column gap={8}>
      <Eyebrow text={ADDRESS_LABEL.toUpperCase()} size="3xs" color="secondary" />
      <ListViewItem align="center" gap={12} dark={dark} onPress={onCopy}>
        <Column weight={1}>
          <Text text={address || '-'} size="xs" truncate />
        </Column>
        <AppIcon name={IconSquareBehindSquare1} color="secondary" size={16} />
      </ListViewItem>
      <Text size="md" variant="caption" text={ADDRESS_HINT} color="secondary" textAlign="center" />
    </Column>
  );
}

function AddressQr({ address, border }: { address: string; border: string }): React.ReactElement {
  return (
    <QrPanel
      value={address || null}
      size={QR_SIZE}
      padding={16}
      radius="xl"
      border={border}
      placeholder={<Column width={QR_SIZE} height={QR_SIZE} background={QR_PLACEHOLDER_BACKGROUND} />}
    />
  );
}

export function ReceiveScreen(): React.ReactElement {
  const { border } = usePalette();

  const { data: active } = useQuery({ queryKey: ['receiveActiveAccount'], queryFn: getActiveAccount });
  const address = active?.address ?? '';

  const onCopy = (): void => {
    if (!address) return;
    capabilities.copy('Address', address);
  };

  return (
    <Column surface="surface" weight={1}>
      <StackHeader title="Receive" wallet />

      <ScreenScroll contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <Column width="100%" align="center" gap={16}>
          <AddressQr address={address} border={border} />
          <AddressCard address={address} onCopy={onCopy} />
        </Column>
      </ScreenScroll>
    </Column>
  );
}
