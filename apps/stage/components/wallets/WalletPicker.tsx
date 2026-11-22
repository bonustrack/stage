import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconWallet1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet1';
import { AppModal } from '../AppModal';
import { Column } from '../layout';
import { WalletConnectLogo } from '../onboarding/BrandLogos';
import { capabilities } from '../../lib/capabilities';
import { ignored } from '../../lib/errorPolicy';
import { injectedWallets, subscribeInjectedWallets } from '../../lib/injectedWallets';
import type { InjectedWallet } from '../../lib/injectedWallets.model';
import { WALLETCONNECT_PROJECT_ID } from '../../lib/privyConfig';
import { useStoreValue } from '../../lib/storeCore';
import { useEffectiveColorScheme, usePalette, withAlpha } from '../../lib/theme';
import { cancelWalletConnectPairing, useWalletConnectUri } from '../../lib/walletConnectPairing';
import { cancelWalletPicker, pickWallet, useWalletPicker, type WalletChoice } from '../../lib/walletPicker';
import { NO_WALLET, WALLETCONNECT_ID, orderEntries, tagOf, walletPickerCopy, type PickerEntry, type WalletTag } from './WalletPicker.model';

const ICON_SIZE = 32;
const QR_SIZE = 240;
const PHONE = Platform.OS !== 'web';

function close(): void {
  cancelWalletConnectPairing();
  cancelWalletPicker();
}

function WalletIcon({ wallet }: { wallet: InjectedWallet }): React.ReactElement {
  const pal = usePalette();
  const [failed, setFailed] = useState(false);
  if (wallet.icon === '' || failed) return <Glyph icon={IconWallet1} size={ICON_SIZE} color={pal.primary} />;
  return (
    <Image
      url={wallet.icon}
      size={ICON_SIZE}
      radius="md"
      fit="contain"
      description={wallet.name}
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

function TagPill({ tag }: { tag: WalletTag }): React.ReactElement | null {
  const pal = usePalette();
  if (tag === null) return null;
  if (tag === 'Recent') return <Badge label={tag} color={pal.link} background={withAlpha(pal.link, 0.16)} />;
  return <Badge label={tag} color="secondary" variant="soft" />;
}

interface Entry extends PickerEntry {
  icon: React.ReactNode;
  choice: WalletChoice;
}

function entriesOf(wallets: readonly InjectedWallet[], walletConnect: boolean): Entry[] {
  const injected = wallets.map<Entry>((wallet) => ({
    id: wallet.rdns,
    name: wallet.name,
    injected: true,
    icon: <WalletIcon wallet={wallet} />,
    choice: { kind: 'injected', rdns: wallet.rdns },
  }));
  if (!walletConnect) return injected;
  const icon = <WalletConnectLogo size={ICON_SIZE} />;
  return [...injected, { id: WALLETCONNECT_ID, name: 'WalletConnect', injected: false, icon, choice: { kind: 'walletconnect' } }];
}

function WalletList({ recent }: { recent: string | null }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const wallets = useStoreValue(subscribeInjectedWallets, injectedWallets);
  const entries = orderEntries(entriesOf(wallets, WALLETCONNECT_PROJECT_ID !== undefined), recent);
  if (entries.length === 0) return <Text text={NO_WALLET} size="2xs" color="secondary" textAlign="center" />;
  return (
    <ListView dark={dark}>
      {entries.map((entry) => (
        <ListViewItem
          key={entry.id}
          align="center"
          gap={12}
          dark={dark}
          onPress={() => {
            pickWallet(entry.choice);
          }}
        >
          {entry.icon}
          <Column weight={1}>
            <Text text={entry.name} size="sm" color="text" />
          </Column>
          <TagPill tag={tagOf(entry, recent)} />
        </ListViewItem>
      ))}
    </ListView>
  );
}

function PairingCode({ uri }: { uri: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Column gap={14} align="center" width="100%">
      <Column padding={12} background="#ffffff" style={{ borderRadius: 12 }}>
        <QrCode value={uri} size={QR_SIZE} />
      </Column>
      {PHONE ? (
        <Button
          dark={dark}
          variant="soft"
          color="primary"
          size="lg"
          fullWidth
          label="Open wallet app"
          onPress={() => {
            void Linking.openURL(uri).catch(ignored(undefined, 'optional'));
          }}
        />
      ) : null}
      <Button
        dark={dark}
        variant={PHONE ? 'ghost' : 'soft'}
        color="primary"
        size="lg"
        fullWidth
        label="Copy link"
        onPress={() => {
          capabilities.copy('Link', uri);
        }}
      />
    </Column>
  );
}

function PickerBody({ uri, listing, recent }: { uri: string | null; listing: boolean; recent: string | null }): React.ReactElement {
  const pal = usePalette();
  if (uri !== null) return <PairingCode uri={uri} />;
  if (listing) return <WalletList recent={recent} />;
  return (
    <Column align="center" padding={{ y: 12 }}>
      <Spinner size={24} color={pal.link} />
    </Column>
  );
}

export function WalletPicker(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const view = useWalletPicker();
  const uri = useWalletConnectUri();
  const copy = walletPickerCopy(view, uri !== null, PHONE);
  return (
    <AppModal visible={view !== null || uri !== null} onClose={close} title={copy.title}>
      <Column gap={14} width="100%">
        {copy.about === null ? null : <Text text={copy.about} size="2xs" color="secondary" textAlign="center" />}
        <PickerBody uri={uri} listing={view?.view === 'list'} recent={view?.recent ?? null} />
        <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label="Cancel" onPress={close} />
      </Column>
    </AppModal>
  );
}
