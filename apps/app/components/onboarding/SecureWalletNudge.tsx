/** "Secure your wallet" nudge — SKIPPABLE post-onboarding backup prompt.
 *
 *  Onboarding deliberately does NOT show the recovery phrase (Less's locked
 *  decision: defer backup). This card is where the user can, later and at their
 *  own pace, actually secure the wallet:
 *    - Back up recovery phrase  -> reveal the phrase (device auth) + a confirm
 *      step, then mark it backed up so the nudge stops showing.
 *    - Add guardians            -> route to the existing /wallet/recovery screen.
 *
 *  It is never forced: a "Dismiss" action hides it (persisted) without backing
 *  up. It only renders for a `smart` account that has not been backed up or
 *  dismissed yet, so it self-hides once handled. Lives at the top of Settings ->
 *  Security (see SecuritySettings).
 *
 *  Reveal/confirm UI is intentionally minimal (no screenshots-block etc. — that
 *  can come later); the phrase comes from the keyring's revealRecoveryPhrase()
 *  which prompts device auth (the only guarded path that returns the mnemonic). */

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col, Row, Box } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { flash } from '../../lib/toast';
import { getActiveAccount } from '../../lib/accounts';
import { revealRecoveryPhrase } from '../../lib/zerodev';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { isWalletBackedUp, setWalletBackedUp } from '../../lib/walletBackup';

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
                label="Add guardians" onPress={() => router.push('/wallet/recovery')}/>
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
                label="Hide" onPress={() => setPhrase(null)}/>
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
