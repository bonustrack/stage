
import { useRouter } from 'expo-router';

import { Text } from '@stage-labs/kit/react-native/text';
import { walletAccountRows } from './WalletSettings.model';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useWalletModel } from './WalletSettings.parts';
import { useEnablePasskey, useRemovePasskey } from '../../lib/passkey';
import { SmartAccountSections, WalletCopyRow, WalletInfoRow } from './WalletSettings.sections';
import { SettingsCard, SettingsPage, SettingsSectionLabel } from './SettingsPage';
import { SettingsList } from './rows';

export function WalletSettings(): React.ReactElement {
  const router = useRouter();
  const { text: fg } = usePalette();

  const { model, deploy } = useWalletModel();
  const passkey = useEnablePasskey();
  const removePasskey = useRemovePasskey();

  const onRecovery = (): void => { router.push('/wallet/recovery'); };

  return (
    <SettingsPage title="Wallet">
      {!model ? (
        <Text size="md" color={fg} style={{ padding: 24 }}>No active account.</Text>
      ) : (
        <>
          <SettingsSectionLabel>ACCOUNT</SettingsSectionLabel>
          <SettingsCard>
            <SettingsList>
              {walletAccountRows(model).map((row) => (
                <WalletInfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </SettingsList>
          </SettingsCard>

          <SettingsSectionLabel>{model.isSmart ? 'SMART ACCOUNT ADDRESS' : 'ADDRESS'}</SettingsSectionLabel>
          <SettingsCard>
            <SettingsList>
              <WalletCopyRow
                label="Address"
                value={model.address}
                onCopy={() => { capabilities.copy('Address', model.address); }}
              />
            </SettingsList>
          </SettingsCard>

          {model.isSmart ? (
            <SmartAccountSections
              model={model} deploy={deploy}
              passkey={passkey} removePasskey={removePasskey}
              onCopy={(label, value) => { capabilities.copy(label, value); }} onRecovery={onRecovery}
            />
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}
