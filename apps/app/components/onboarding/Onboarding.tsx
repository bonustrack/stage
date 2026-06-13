/** First-launch ONBOARDING flow — mnemonic + ZeroDev-only account model.
 *
 *  This is the PRIMARY entry: the root layout (app/_layout.tsx) renders it as an
 *  opaque overlay whenever the account registry is empty (lib/accountGate), and
 *  it goes away the instant a wallet is created/restored (the flow bumps the
 *  account epoch -> the gate flips -> the live app underneath shows).
 *
 *  STEPS (a tiny internal state machine, no navigator — this is an overlay):
 *    welcome  -> "Create new wallet" | "I have a recovery phrase"
 *    restore  -> paste + validate a BIP-39 phrase
 *    passkey  -> SKIPPABLE "Add a passkey" (skip = ECDSA-only)
 *
 *  Locked design (Less): NO recovery phrase is shown here (backup is deferred to
 *  a skippable nudge — see SecureWalletNudge), passkey is SKIPPABLE, and the
 *  Welcome screen uses a CLEAN STATIC background (the animated kaleidoscope /
 *  dithered flipbook is gone from onboarding). XMTP cutover stays OFF.
 *
 *  The heavy lifting (mnemonic + Kernel) lives in ./flow; the screens are dumb. */

import { useState } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize } from '@metro-labs/kit/tokens';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Textarea } from '@metro-labs/kit/textarea';
import { Col, Box } from '../layout';
import { usePalette, useEffectiveColorScheme, DANGER } from '../../lib/theme';
import { passkeysAvailable } from '../../lib/zerodev';
import { createWallet, restoreWallet } from './flow';

type Step = 'welcome' | 'restore' | 'passkey';

export interface OnboardingProps {
  /** Called when a wallet exists and the user is in the app. Kept for parity —
   *  the account gate also flips on its own when the flow creates an account. */
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('welcome');
  const [phrase, setPhrase] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  /** The chosen path is run AFTER the passkey decision, so remember it. */
  type Choice = { kind: 'create' } | { kind: 'restore'; phrase: string };
  const [pending, setPending] = useState<Choice | null>(null);

  const padBottom = 16 + insets.bottom;
  const padTop = 24 + insets.top;

  /** Build the account for a chosen path + passkey decision, then enter the app. */
  const run = (choice: Choice, withPasskey: boolean): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        if (choice.kind === 'create') await createWallet(withPasskey);
        else await restoreWallet(choice.phrase, withPasskey);
        onDone();
      } catch (e) {
        setBusy(false);
        setPending(null);
        setStep('welcome');
        Alert.alert('Could not set up wallet', e instanceof Error ? e.message : String(e));
      }
    })();
  };

  /** Advance to the (skippable) passkey step, or run straight through (ECDSA-only)
   *  when passkeys aren't available on this build. */
  const toPasskey = (choice: Choice): void => {
    setPending(choice);
    if (!passkeysAvailable()) { run(choice, false); return; }
    setStep('passkey');
  };

  const onRestoreNext = (): void => {
    const p = phrase.trim();
    if (!p) { setErr('Enter your recovery phrase.'); return; }
    setErr('');
    toPasskey({ kind: 'restore', phrase: p });
  };

  return (
    <Col surface="surface" flex={1} padding={{ x: 24, top: padTop, bottom: padBottom }}>
      {step === 'welcome' ? (
        <Col flex={1} justify="between">
          <Box padding={{ top: 48 }}>
            <Title level={1} color={pal.text}>Metro</Title>
            <Text size="md" color={pal.sub} style={{ marginTop: 10 }}>
              Your wallet, your messages, your governance. One gasless smart account.
            </Text>
          </Box>
          <Col gap={10}>
            <Button
              dark={dark} variant="primary" size="lg" fullWidth
              tintBg={pal.primary} tintFg={pal.bg}
              label="Create new wallet"
              disabled={busy}
              onPress={() => toPasskey({ kind: 'create' })}
            />
            <Button
              dark={dark} variant="secondary" size="lg" fullWidth
              label="I have a recovery phrase"
              disabled={busy}
              onPress={() => { setErr(''); setStep('restore'); }}
            />
          </Col>
        </Col>
      ) : null}

      {step === 'restore' ? (
        <Col flex={1} justify="between">
          <Box padding={{ top: 8 }}>
            <Title level={2} color={pal.text}>Restore wallet</Title>
            <Text size="sm" color={pal.sub} style={{ marginTop: 8, marginBottom: 14 }}>
              Enter your 12-24 word recovery phrase, separated by spaces.
            </Text>
            <Textarea
              value={phrase}
              onChangeText={(t) => { setPhrase(t); setErr(''); }}
              placeholder="word1 word2 word3 ..."
              placeholderTextColor={pal.sub}
              dark={dark}
              inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
              style={{
                color: pal.text, fontFamily: 'Menlo', fontSize: fontSize('sm'),
                minHeight: 110, height: undefined,
                borderWidth: 1, borderColor: pal.border, borderRadius: 12,
                paddingHorizontal: 12, paddingVertical: 12,
                textAlignVertical: 'top', backgroundColor: 'transparent',
              }}
            />
            {err ? <Text size="xs" color={DANGER} style={{ marginTop: 8 }}>{err}</Text> : null}
          </Box>
          <Col gap={10}>
            <Button
              dark={dark} variant="primary" size="lg" fullWidth
              tintBg={pal.primary} tintFg={pal.bg}
              label="Continue" disabled={busy || !phrase.trim()}
              onPress={onRestoreNext}
            />
            <Button
              dark={dark} variant="ghost" size="lg" fullWidth
              label="Back" disabled={busy}
              onPress={() => { setErr(''); setStep('welcome'); }}
            />
          </Col>
        </Col>
      ) : null}

      {step === 'passkey' ? (
        <Col flex={1} justify="between">
          <Box padding={{ top: 8 }}>
            <Title level={2} color={pal.text}>Add a passkey</Title>
            <Text size="sm" color={pal.sub} style={{ marginTop: 8 }}>
              Add a passkey so this device can approve transactions without your
              recovery phrase. You will only be asked for it when you sign. You can
              add one later.
            </Text>
          </Box>
          <Col gap={10}>
            <Button
              dark={dark} variant="primary" size="lg" fullWidth
              tintBg={pal.primary} tintFg={pal.bg}
              label="Add a passkey" disabled={busy}
              onPress={() => { if (pending) run(pending, true); }}
            />
            <Button
              dark={dark} variant="ghost" size="lg" fullWidth
              label="Skip for now" disabled={busy}
              onPress={() => { if (pending) run(pending, false); }}
            />
          </Col>
        </Col>
      ) : null}
    </Col>
  );
}
