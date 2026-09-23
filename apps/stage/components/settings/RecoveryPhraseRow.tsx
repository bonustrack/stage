import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
import {
  BACKUP_PHRASE_COPY, SHOW_PHRASE_COPY, SHOWN_PHRASE_TIMEOUT_MS,
  phrasePanelActions, phraseRowCopy, type PhraseRowMode,
} from './SecuritySettings.model';

const BACKED_UP_KEY = ['walletBackedUp'] as const;

export function useWalletBackedUp(): boolean | null {
  const { data } = useQuery({ queryKey: BACKED_UP_KEY, queryFn: () => isWalletBackedUp(), staleTime: Infinity });
  return data ?? null;
}

interface PanelProps { mode: PhraseRowMode; phrase: string; onHide: () => void; onSaved: () => void }

function RevealedPhrase({ mode, phrase, onHide, onSaved }: PanelProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const copy = phraseRowCopy(mode);
  const actions = phrasePanelActions(mode);
  return (
    <ListViewItem align="start" gap={12} dark={dark}>
      <Col flex={1} gap={12}>
        <Text value={copy.label} size="md" weight="semibold" color="link" />
        <Caption value={copy.revealed} color="secondary" />
        <Box padding={12} radius="lg" surface="surface">
          <Text value={phrase} size="md" variant="mono" color="text" selectable style={{ lineHeight: 24 }} />
        </Box>
        <Row gap={8}>
          {actions.includes('hide') ? <Button dark={dark} variant="ghost" size="md" fullWidth style={{ flex: 1 }} label="Hide" onPress={onHide} /> : null}
          {actions.includes('saved') ? <Button dark={dark} size="md" fullWidth style={{ flex: 1 }} label="I saved it" onPress={onSaved} /> : null}
        </Row>
      </Col>
    </ListViewItem>
  );
}

function useAutoHide(active: boolean, hide: () => void): void {
  useFocusEffect(useCallback(() => (active ? hide : undefined), [active, hide]));
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(hide, SHOWN_PHRASE_TIMEOUT_MS);
    return () => { clearTimeout(timer); };
  }, [active, hide]);
}

function confirmShow(): Promise<boolean> {
  return capabilities.confirm({
    title: SHOW_PHRASE_COPY.confirmTitle,
    message: SHOW_PHRASE_COPY.confirmMessage,
    confirmLabel: SHOW_PHRASE_COPY.confirmLabel,
    destructive: true,
  });
}

export function RecoveryPhraseRow({ rec, mode }: { rec: AccountRecord; mode: PhraseRowMode }): React.ReactElement {
  const queryClient = useQueryClient();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hide = useCallback((): void => { setPhrase(null); }, []);
  useAutoHide(mode === 'show' && phrase !== null, hide);

  const reveal = (): void => {
    if (busy) return;
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        if (mode === 'show' && !(await confirmShow())) return;
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

  const copy = phraseRowCopy(mode);
  if (phrase !== null) return <RevealedPhrase mode={mode} phrase={phrase} onHide={hide} onSaved={saved} />;
  return (
    <SettingsButtonRow label={copy.label} description={copy.description} iconStart="shieldCheck" onPress={reveal} />
  );
}
