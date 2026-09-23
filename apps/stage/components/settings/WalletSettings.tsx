

import { Text } from '@stage-labs/kit/react-native/text';
import { WALLET_SECURITY_LINK, walletAccountRows } from './WalletSettings.model';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useWalletModel } from './WalletSettings.parts';
import { SmartAccountSections, WalletCopyRow, WalletInfoRow } from './WalletSettings.sections';
import { SettingsCard, SettingsPage, SettingsSectionLabel } from './SettingsPage';
import { SettingsList, SettingsNavRow } from './rows';

export function WalletSettings(): React.ReactElement {
  const { text: fg } = usePalette();

  const { model, deploy } = useWalletModel();

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
              onCopy={(label, value) => { capabilities.copy(label, value); }}
            />
          ) : null}

          <SettingsSectionLabel>SECURITY</SettingsSectionLabel>
          <SettingsCard>
            <SettingsList>
              <SettingsNavRow label={WALLET_SECURITY_LINK.label} iconStart={WALLET_SECURITY_LINK.icon}
                onPress={() => { capabilities.navigate(WALLET_SECURITY_LINK.href); }} />
            </SettingsList>
          </SettingsCard>
        </>
      )}
    </SettingsPage>
  );
}
