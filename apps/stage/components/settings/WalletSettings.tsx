
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@stage-labs/kit/react-native/text';
import { walletAccountRows } from './WalletSettings.model';
import { Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging/account';
import { flash } from '../../lib/toast';
import { useWalletModel } from './WalletSettings.parts';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { useRemovePasskey } from '../../lib/useRemovePasskey';
import {
  type C, SectionLabel, makeCard, SmartAccountSections, WalletCopyRow, WalletInfoRow,
} from './WalletSettings.sections';
import { SettingsHeader } from './SettingsHeader';
import { SettingsList } from './rows';

export function WalletSettings(): React.ReactElement {
  const epoch = useActiveAccount();
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const blockRadius = useBlockRadius();
  const insets = useSafeAreaInsets();
  const c: C = { fg, head, sub: fg, border, rowBg: border };

  const { model, deploy } = useWalletModel(epoch);
  const passkey = useEnablePasskey(epoch);
  const removePasskey = useRemovePasskey(epoch);

  const onCopy = (label: string, value: string): void => {
    void Clipboard.setStringAsync(value); flash(`${label} copied`);
  };
  const onRecovery = (): void => { router.push('/wallet/recovery'); };

  const card = makeCard(dark, c.rowBg, blockRadius);

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Wallet"/>
      <ScrollView style={[{ flex: 1 }, WEB_STACK_SCROLL]} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        {!model ? (
          <Text size="md" color={c.sub} style={{ padding: 24 }}>No active account.</Text>
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
      </ScrollView>
    </Col>
  );
}
