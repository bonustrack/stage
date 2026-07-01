
import { useEffect, useMemo, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, receiveView, screenHeader, SCREEN_BACK, WALLET_ADDRESS_COPY } from '@stage-labs/views';
import { Col } from '../../components/layout';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { usePalette } from '../../lib/theme';
import { flash } from '../../lib/toast';
import { ReceiveModeToggle, type ReceiveMode } from '../../components/wallet/ReceiveModeToggle';
import { receiveViewModel } from '@stage-labs/client/wallet/receive';

export default function WalletReceive(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<ReceiveMode>('public');
  const [publicAddress, setPublicAddress] = useState('');
  const { snapshot } = usePrivateWallet();
  const privateAddress = snapshot?.zkAddress ?? '';
  const privateReady = privateAddress.length> 0;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!cancelled) setPublicAddress(client.publicIdentity.identifier);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, []);

  const { activeMode, address, label, hint } = receiveViewModel({
    mode, publicAddress, privateAddress, privateReady,
  });

  const copy = (): void => {
    if (!address) return;
    void Clipboard.setStringAsync(address);
    flash(activeMode === 'private' ? '0zk address copied' : 'Address copied');
  };

  const addressNode = useMemo(
    () => receiveView({ address, label, hint, borderColor: border }),
    [address, label, hint, border],
  );
  const headerNode = basicRoot(screenHeader({
    title: 'Receive',
    titleStyle: { kind: 'text', size: 'xl', weight: 'semibold', color: head },
    backColor: fg,
    safeTop: insets.top,
    surface: toolbarBg,
    borderColor: border,
  }));

  const actions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [WALLET_ADDRESS_COPY]: () => { copy(); },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions} />

      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <ReceiveModeToggle
          mode={activeMode}
          onChange={setMode}
          privateReady={privateReady}
/>

        <Col width="100%">
          <ViewHost node={addressNode} actions={actions} />
        </Col>
      </ScrollView>
    </Col>
  );
}
