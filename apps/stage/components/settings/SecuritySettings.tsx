import { useState } from 'react';
import { Alert } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { capabilities } from '../../lib/capabilities';
import { getPrivateKey, canExportPrivateKey, type AccountRecord } from '../../lib/accounts';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { SettingsGroup, SettingsNavRow, SettingsPage } from './SettingsPage';
import { RecoveryPhraseRow, useWalletBackedUp } from './RecoveryPhraseRow';
import { securityRows } from './SecuritySettings.model';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { Column } from '../layout';

interface RevealedKey {
  id: string;
  pk: string;
}

function confirmExport(rec: AccountRecord, setRevealed: (key: RevealedKey) => void): void {
  void capabilities
    .confirm({
      title: 'Export private key',
      message: 'Anyone with this key controls your account. Never share it, and make sure no one can see your screen.',
      confirmLabel: 'Reveal key',
      destructive: true,
    })
    .then(async (ok) => {
      if (!ok) return;
      const pk = await getPrivateKey(rec.id);
      if (!pk) {
        Alert.alert('No key', 'This account has no exportable private key.');
        return;
      }
      setRevealed({ id: rec.id, pk });
    });
}

function RevealedKeyRow({ dark, revealed }: { dark: boolean; revealed: string }): React.ReactElement {
  const { text, link } = usePalette();
  return (
    <ListViewItem
      dark={dark}
      align="start"
      onPress={() => {
        capabilities.copy('Private key', revealed);
      }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Glyph icon={IconWallet4} size={24} color={link} />
      <Column weight={1}>
        <Text size="sm" color={text}>
          Tap to copy private key
        </Text>
        <Text size="3xs" selectable color={text} style={{ marginTop: 4 }}>
          {revealed}
        </Text>
      </Column>
      <Glyph icon={IconSquareBehindSquare1} size={20} color={link} />
    </ListViewItem>
  );
}

function KeyRows({ rec }: { rec: AccountRecord }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [key, setRevealed] = useState<RevealedKey | null>(null);
  const backedUp = useWalletBackedUp();
  const revealed = key?.id === rec.id ? key.pk : null;
  const keys = securityRows({
    isSmart: rec.type === 'smart',
    backedUp,
    canExportKey: canExportPrivateKey(rec),
    keyRevealed: revealed !== null,
  });
  return (
    <SettingsGroup title="Keys" footnote={SECURITY_FOOTNOTE}>
      {revealed && canExportPrivateKey(rec) ? <RevealedKeyRow dark={dark} revealed={revealed} /> : null}
      {keys.map((k) =>
        k === 'exportKey' ? (
          <SettingsNavRow
            key={k}
            label="Export private key"
            iconStart={IconWallet4}
            iconEnd={IconChevronBottom}
            onPress={() => {
              confirmExport(rec, setRevealed);
            }}
          />
        ) : (
          <RecoveryPhraseRow key={`${k}:${rec.id}`} rec={rec} mode={k === 'backupPhrase' ? 'backup' : 'show'} />
        ),
      )}
    </SettingsGroup>
  );
}

const SECURITY_FOOTNOTE = 'Your recovery phrase or private key controls your account. Keep it somewhere safe.';

export function SecuritySettings(): React.ReactElement {
  const rec = useActiveAccountRecord();
  return <SettingsPage title="Security">{rec ? <KeyRows rec={rec} /> : null}</SettingsPage>;
}
