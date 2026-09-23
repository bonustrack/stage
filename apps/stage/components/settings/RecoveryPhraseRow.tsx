import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { revealRecoveryPhrase } from '../../lib/zerodev';
import { isWalletBackedUp, setWalletBackedUp } from '../../lib/walletBackup';
import { Box, Col, Row } from '../layout';
import { SettingsButtonRow } from './rows';
import { BACKUP_PHRASE_COPY } from './SecuritySettings.model';

const BACKED_UP_KEY = ['walletBackedUp'] as const;

export function useWalletBackedUp(): boolean | null {
  const { data } = useQuery({ queryKey: BACKED_UP_KEY, queryFn: () => isWalletBackedUp(), staleTime: Infinity });
  return data ?? null;
}

function RevealedPhrase({ phrase, onHide, onSaved }: { phrase: string; onHide: () => void; onSaved: () => void }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="start" gap={12} dark={dark}>
      <Col flex={1} gap={12}>
        <Text value={BACKUP_PHRASE_COPY.label} size="md" weight="semibold" color="link" />
        <Caption value={BACKUP_PHRASE_COPY.revealed} color="secondary" />
        <Box padding={12} radius="lg" surface="surface">
          <Text value={phrase} size="md" variant="mono" color="text" selectable style={{ lineHeight: 24 }} />
        </Box>
        <Row gap={8}>
          <Button dark={dark} variant="ghost" size="md" fullWidth style={{ flex: 1 }} label="Hide" onPress={onHide} />
          <Button dark={dark} size="md" fullWidth style={{ flex: 1 }} label="I saved it" onPress={onSaved} />
        </Row>
      </Col>
    </ListViewItem>
  );
}

export function RecoveryPhraseRow({ rec }: { rec: AccountRecord }): React.ReactElement {
  const queryClient = useQueryClient();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = (): void => {
    if (busy) return;
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        const words = await revealRecoveryPhrase(rec);
        if (!words) throw new Error(BACKUP_PHRASE_COPY.missing);
        setPhrase(words);
      } catch (e) {
        capabilities.toast(e instanceof Error ? e.message : BACKUP_PHRASE_COPY.unreadable);
      } finally {
        setBusy(false);
      }
    })();
  };

  const saved = (): void => {
    void (async (): Promise<void> => {
      await setWalletBackedUp(true);
      setPhrase(null);
      queryClient.setQueryData(BACKED_UP_KEY, true);
      capabilities.toast(BACKUP_PHRASE_COPY.saved);
    })();
  };

  if (phrase !== null) return <RevealedPhrase phrase={phrase} onHide={() => { setPhrase(null); }} onSaved={saved} />;
  return (
    <SettingsButtonRow label={BACKUP_PHRASE_COPY.label} description={BACKUP_PHRASE_COPY.description} iconStart="shieldCheck" onPress={reveal} />
  );
}
