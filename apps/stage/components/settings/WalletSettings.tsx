
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from '../../lib/safeArea';

import { Text } from '@stage-labs/kit/react-native/text';
import { walletAccountRows } from './WalletSettings.model';
import { Col, ScreenScroll } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useWalletModel } from './WalletSettings.parts';
import { useEnablePasskey, useRemovePasskey } from '../../lib/passkey';
import {
  SectionLabel, makeCard, SmartAccountSections, WalletCopyRow, WalletInfoRow,
} from './WalletSettings.sections';
import { SettingsHeader } from '../chrome/SettingsHeader';
import { SettingsList } from './rows';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';

export function WalletSettings(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, border } = usePalette();
  const insets = useSafeAreaInsets();

  const { model, deploy } = useWalletModel();
  const passkey = useEnablePasskey();
  const removePasskey = useRemovePasskey();

  const onCopy = (label: string, value: string): void => {
    void Clipboard.setStringAsync(value); capabilities.toast(`${label} copied`);
  };
  const onRecovery = (): void => { router.push('/wallet/recovery'); };

  const card = makeCard(dark, border, BLOCK_RADIUS_DEFAULT);

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Wallet"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {!model ? (
          <Text size="md" color={fg} style={{ padding: 24 }}>No active account.</Text>
        ) : (
          <>
            <SectionLabel>ACCOUNT</SectionLabel>
            {card(
              <SettingsList>
                {walletAccountRows(model).map((row) => (
                  <WalletInfoRow key={row.label} label={row.label} value={row.value} />
                ))}
              </SettingsList>,
            )}

            <SectionLabel>{model.isSmart ? 'SMART ACCOUNT ADDRESS' : 'ADDRESS'}</SectionLabel>
            {card(
              <SettingsList>
                <WalletCopyRow
                  label="Address"
                  value={model.address}
                  onCopy={() => { onCopy('Address', model.address); }}
                />
              </SettingsList>,
            )}

            {model.isSmart ? (
              <SmartAccountSections
                model={model} deploy={deploy} card={card}
                passkey={passkey} removePasskey={removePasskey}
                onCopy={onCopy} onRecovery={onRecovery}
              />
            ) : null}
          </>
        )}
      </ScreenScroll>
    </Col>
  );
}
