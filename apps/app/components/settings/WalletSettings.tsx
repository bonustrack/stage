/** @file Settings -> Wallet screen: a read-only view of the active ZeroDev smart-account (address, signer, Kernel modules, deploy status, versions, XMTP address) with a link to recovery. */

import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@stage-labs/kit/text';
import { Col } from '../layout';
import { SystemHeader } from '../system/SystemHeader';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging/account';
import { flash } from '../../lib/toast';
import { useWalletModel } from './WalletSettings.parts';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { useRemovePasskey } from '../../lib/useRemovePasskey';
import {
  type C, CopyRow, InfoRow, SectionLabel, makeCard, SmartAccountSections,
} from './WalletSettings.sections';

/** Renders the wallet settings screen for managing the account's wallet. */
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

  const card = makeCard(dark, c.rowBg, blockRadius);
  /** Copy a value to the clipboard and flash a confirmation toast. */
  const onCopy = (label: string, value: string): void => {
    void Clipboard.setStringAsync(value); flash(`${label} copied`);
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Wallet" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {!model ? (
          <Text size="md" color={c.sub} style={{ padding: 24 }}>No active account.</Text>
        ) : (
          <>
            <SectionLabel c={c}>ACCOUNT</SectionLabel>
            {card(
              <>
                <InfoRow label="Name" value={model.label} dark={dark} c={c} />
                {model.hdIndex != null ? (
                  <InfoRow label="HD index" value={`#${model.hdIndex}`} dark={dark} c={c} />
                ) : null}
                <InfoRow
                  label="Type"
                  value={model.isSmart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${model.rec.type})`}
                  dark={dark} c={c}
                />
                {model.isSmart ? (
                  <InfoRow label="Active signer" value={model.activeSigner} dark={dark} c={c} />
                ) : null}
              </>,
            )}

            <SectionLabel c={c}>{model.isSmart ? 'SMART ACCOUNT ADDRESS' : 'ADDRESS'}</SectionLabel>
            {card(<CopyRow label="Address" value={model.address} dark={dark} c={c} onCopy={onCopy} />)}

            {model.isSmart ? (
              <SmartAccountSections
                model={model} deploy={deploy} dark={dark} c={c} card={card}
                passkey={passkey} removePasskey={removePasskey} onCopy={onCopy}
                onRecovery={() => { router.push('/wallet/recovery'); }}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Col>
  );
}
