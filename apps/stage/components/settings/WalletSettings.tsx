import { Text } from '@stage-labs/kit/react-native/text';
import { walletAccountRows, walletDeployLabel } from './WalletSettings.model';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useWalletModel } from './WalletSettings.parts';
import { SmartAccountSections, WalletCopyRow, WalletInfoRow } from './WalletSettings.sections';
import { SettingsGroup, SettingsPage } from './SettingsPage';

export function WalletSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const { model, deploy } = useWalletModel();

  return (
    <SettingsPage title="Wallet">
      {!model ? (
        <Text size="md" color={fg} style={{ padding: 24 }}>No active account.</Text>
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

          {model.isSmart ? (
            <SmartAccountSections
              model={model}
              onCopy={(label, value) => { capabilities.copy(label, value); }}
            />
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}
