import { Fragment, useState } from 'react';

import { Alert } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { capabilities } from '../../lib/capabilities';
import { Col } from '../layout';
import { getPrivateKey, canExportPrivateKey, type AccountRecord } from '../../lib/accounts';
import { useActiveAccountRecord } from '../../modules/messaging';
import { SettingsNavRow } from './rows';
import { SettingsGroup } from './SettingsPage';
import { RecoveryPhraseRow, useWalletBackedUp } from './RecoveryPhraseRow';
import { securityRows, type SecurityRowKey } from './SecuritySettings.model';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';

interface RevealedKey { id: string; pk: string }

function confirmExport(rec: AccountRecord, setRevealed: (key: RevealedKey) => void): void {
  Alert.alert(
    'Export private key',
    'Anyone with this key controls your account. Never share it, and make sure no one can see your screen.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reveal key', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            const pk = await getPrivateKey(rec.id);
            if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
            setRevealed({ id: rec.id, pk });
          })();
        } },
    ],
  );
}

function RevealedKeyRow({ dark, revealed }: { dark: boolean; revealed: string }): React.ReactElement {
  const { text, link } = usePalette();
  return (
    <ListViewItem
      dark={dark}
      align="start"
      onPress={() => { capabilities.copy('Private key', revealed); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Glyph icon={IconWallet4} size={24} color={link} />
      <Col flex={1}>
        <Text size="sm" color={text}>Tap to copy private key</Text>
        <Text size="4xs" selectable color={text} style={{ marginTop: 4 }}>{revealed}</Text>
      </Col>
      <Glyph icon={IconSquareBehindSquare1} size={20} color={link} />
    </ListViewItem>
  );
}

function revealedKeyFor(key: RevealedKey | null, rec: AccountRecord): string | null {
  if (!key) return null;
  return key.id === rec.id ? key.pk : null;
}

function KeyRows({ rec }: { rec: AccountRecord }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [key, setRevealed] = useState<RevealedKey | null>(null);
  const backedUp = useWalletBackedUp();
  const revealed = revealedKeyFor(key, rec);
  const keys = securityRows({
    isSmart: rec.type === 'smart', backedUp,
    canExportKey: canExportPrivateKey(rec), keyRevealed: revealed !== null,
  });
  const rows: Record<SecurityRowKey, () => React.ReactElement | null> = {
    backupPhrase: () => <RecoveryPhraseRow key={rec.id} rec={rec} mode="backup" />,
    showPhrase: () => <RecoveryPhraseRow key={rec.id} rec={rec} mode="show" />,
    exportKey: () => <SettingsNavRow label="Export private key" iconStart={IconWallet4} iconEnd={IconChevronBottom} onPress={() => { confirmExport(rec, setRevealed); }} />,
  };
  return (
    <SettingsGroup title="Keys" footnote={SECURITY_FOOTNOTE}>
      {revealed && canExportPrivateKey(rec) ? <RevealedKeyRow dark={dark} revealed={revealed} /> : null}
      {keys.map((k) => <Fragment key={k}>{rows[k]()}</Fragment>)}
    </SettingsGroup>
  );
}

const SECURITY_FOOTNOTE = 'Your recovery phrase or private key controls your account. Keep it somewhere safe.';

export function SecuritySection(): React.ReactElement | null {
  const rec = useActiveAccountRecord();
  return rec ? <KeyRows rec={rec} /> : null;
}
