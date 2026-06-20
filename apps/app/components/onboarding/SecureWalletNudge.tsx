/**
 * @file SecureWalletNudge: the skippable post-onboarding "secure your wallet" card (reveal/confirm recovery phrase or add guardians).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Title } from '@stage-labs/kit/title';
import { Text } from '@stage-labs/kit/text';
import { Button } from '@stage-labs/kit/button';
import { Col, Row, Box } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { flash } from '../../lib/toast';
import { getActiveAccount } from '../../lib/accounts';
import { revealRecoveryPhrase } from '../../lib/zerodev';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { isWalletBackedUp, setWalletBackedUp } from '../../lib/walletBackup';

/** Renders a prompt urging the user to back up their wallet, or nothing once it is secured. */
export function SecureWalletNudge(): React.ReactElement | null {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();

  const [show, setShow] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passkey = useEnablePasskey();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const acct = await getActiveAccount();
      const done = await isWalletBackedUp();
      if (alive) setShow(acct?.type === 'smart' && !done);
    })();
    return () => { alive = false; };
  }, []);

  if (!show) return null;

  /** Reveal the phrase (prompts device auth via the hardened secure-store read). */
  const reveal = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const m = await revealRecoveryPhrase();
        if (!m) throw new Error('No recovery phrase on this device.');
        setPhrase(m);
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not read recovery phrase');
      } finally {
        setBusy(false);
      }
    })();
  };

  /** Confirm the user saved it: mark backed up + hide. */
  const confirm = (): void => {
    void (async () => {
      await setWalletBackedUp(true);
      setPhrase(null);
      setShow(false);
      flash('Recovery phrase backed up');
    })();
  };

  /** Dismiss helper. */
  const dismiss = (): void => {
    void (async () => { await setWalletBackedUp(true); setShow(false); })();
  };

  return (
    <Box padding={{ x: 16, top: 16 }}>
      <Col surface="raised" gap={12}
        padding={16}
        style={{ borderWidth: 1, borderColor: pal.border, borderRadius: 14 }}>
        <Title level={3} color={pal.text}>Secure your wallet</Title>

        {phrase == null ? (
          <>
            <Text size="sm" color={pal.sub}>
              Back up your recovery phrase and add guardians so you can recover this
              wallet if you lose your device. You can do this anytime.
            </Text>
            <Col gap={8}>
              <Button dark={dark} variant="primary" size="md" fullWidth
                tintBg={pal.primary} tintFg={pal.bg}
                label="Back up recovery phrase" disabled={busy} onPress={reveal}/>
              {passkey.available ? (
                <Button dark={dark} variant="secondary" size="md" fullWidth
                  disabled={passkey.busy}
                  label={passkey.busy ? 'Enabling passkey…' : 'Enable passkey for signing'}
                  onPress={passkey.run}/>
              ) : null}
              <Button dark={dark} variant="secondary" size="md" fullWidth
                label="Add guardians" onPress={() => { router.push('/wallet/recovery'); }}/>
              <Button dark={dark} variant="ghost" size="md" fullWidth
                label="Not now" onPress={dismiss}/>
            </Col>
          </>
        ) : (
          <>
            <Text size="sm" color={pal.sub}>
              Write these words down in order and keep them somewhere safe. Anyone
              with this phrase controls your wallet.
            </Text>
            <Box padding={12}
              style={{ borderWidth: 1, borderColor: pal.border, borderRadius: 12 }}>
              <Text size="md" variant="mono" color={pal.text} style={{ lineHeight: 24 }}>
                {phrase}
              </Text>
            </Box>
            <Row gap={8}>
              <Button dark={dark} variant="ghost" size="md" fullWidth style={{ flex: 1 }}
                label="Hide" onPress={() => { setPhrase(null); }}/>
              <Button dark={dark} variant="primary" size="md" fullWidth style={{ flex: 1 }}
                tintBg={pal.primary} tintFg={pal.bg}
                label="I saved it" onPress={confirm}/>
            </Row>
          </>
        )}
      </Col>
    </Box>
  );
}
