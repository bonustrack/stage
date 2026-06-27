
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import { settingsHeader, SCREEN_BACK } from '@stage-labs/views';
import { Col } from '../layout';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging/account';
import { flash } from '../../lib/toast';
import { useWalletModel } from './WalletSettings.parts';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { useRemovePasskey } from '../../lib/useRemovePasskey';
import {
  type C, accountNode, addressNode, buildWalletRegistry, SectionLabel, makeCard, SmartAccountSections,
} from './WalletSettings.sections';

export function WalletSettings(): React.ReactElement {
  const epoch = useActiveAccount();
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, toolbarBg } = usePalette();
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

  const registry = {
    ...buildWalletRegistry({ onCopy, onRecovery, passkey, removePasskey }),
    [SCREEN_BACK]: () => { router.back(); },
  };
  const card = makeCard(dark, c.rowBg, blockRadius, registry);

  const headerNode = settingsHeader({
    title: 'Wallet',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  return (
    <Col surface="surface" flex={1}>
      <KitRenderer node={headerNode} registry={registry} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {!model ? (
          <Text size="md" color={c.sub} style={{ padding: 24 }}>No active account.</Text>
        ) : (
          <>
            <SectionLabel>ACCOUNT</SectionLabel>
            {card(accountNode(model))}

            <SectionLabel>{model.isSmart ? 'SMART ACCOUNT ADDRESS' : 'ADDRESS'}</SectionLabel>
            {card(addressNode(model))}

            {model.isSmart ? (
              <SmartAccountSections
                model={model} deploy={deploy} card={card}
                passkey={passkey} removePasskey={removePasskey}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Col>
  );
}
