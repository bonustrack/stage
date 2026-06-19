/**
 * @file Onboarding: the first-launch overlay flow (welcome / restore / passkey steps) shown while the account registry is empty.
 */

import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize } from '@metro-labs/kit/tokens';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Textarea } from '@metro-labs/kit/textarea';
import { Col, Box } from '../layout';
import { Spinner } from '../Spinner';
import { usePalette, useEffectiveColorScheme, DANGER } from '../../lib/theme';
import { passkeysAvailable } from '../../lib/zerodev';
import { createWallet, restoreWallet, bringMessagingOnline, XmtpSetupError, type Stage } from './flow';

type Step = 'welcome' | 'restore' | 'passkey' | 'setup';

/** User-facing label for each setup stage. "Setting up secure messaging" is the ~20s XMTP registration step — the user must understand the wait. */
const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  messaging: 'Setting up secure messaging',
  finishing: 'Finishing up',
};

export interface OnboardingProps {
  /** Called when a wallet exists and the user is in the app. Kept for parity — the account gate also flips on its own when the flow creates an account. */
  onDone: () => void;
}

/** Renders the first-run onboarding flow that introduces the app and creates the wallet. */
export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('welcome');
  const [phrase, setPhrase] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  /** Live setup stage shown on the progress screen, and a recoverable setup error (with the kind so we offer Retry-messaging vs Try again). */
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<{ message: string; accountId?: string } | null>(null);
  /** The chosen path is run AFTER the passkey decision, so remember it. */
  type Choice = { kind: 'create' } | { kind: 'restore'; phrase: string };
  const [pending, setPending] = useState<Choice | null>(null);

  const padBottom = 16 + insets.bottom;
  const padTop = 24 + insets.top;

  /** Build the account for a chosen path + passkey decision, AWAIT full readiness (wallet + XMTP registered), then enter the app. We show the progress screen throughout so the user is never staring at a blind wait. */
  const run = (choice: Choice, withPasskey: boolean): void => {
    if (busy) return;
    setBusy(true);
    setSetupErr(null);
    setStage('wallet');
    setStep('setup');
    void (async () => {
      try {
        if (choice.kind === 'create') await createWallet(withPasskey, setStage);
        else await restoreWallet(choice.phrase, withPasskey, setStage);
        onDone();
      } catch (e) {
        setBusy(false);
        /** XMTP setup failed but the wallet exists + is active: keep the user on the setup screen and offer a plain Retry of the messaging step (no wipe). Any earlier failure (bad phrase, wallet build) is a hard error → back to Welcome to choose again. */
        if (e instanceof XmtpSetupError) {
          setSetupErr({ message: e.message, accountId: e.accountId });
        } else {
          setPending(null);
          setSetupErr({ message: e instanceof Error ? e.message : String(e) });
        }
      }
    })();
  };

  /** Retry only the messaging step for an already-created account (no re-mint). */
  const retryMessaging = (accountId: string): void => {
    if (busy) return;
    setBusy(true);
    setSetupErr(null);
    setStage('messaging');
    void (async () => {
      try {
        await bringMessagingOnline(accountId, setStage);
        onDone();
      } catch (e) {
        setBusy(false);
        setSetupErr({
          message: e instanceof Error ? e.message : String(e),
          accountId,
        });
      }
    })();
  };

  /** Advance to the (skippable) passkey step, or run straight through (ECDSA-only) when passkeys aren't available on this build. */
  const toPasskey = (choice: Choice): void => {
    setPending(choice);
    if (!passkeysAvailable()) { run(choice, false); return; }
    setStep('passkey');
  };

  /** Handle the Restore Next. */
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
            <Title level={1} color={pal.text}>Stage</Title>
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
              onPress={() => { toPasskey({ kind: 'create' }); }}
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

      {step === 'setup' ? (
        <Col flex={1} justify="between">
          <Box padding={{ top: 8 }}>
            <Title level={2} color={pal.text}>
              {setupErr ? 'Setup needs another try' : 'Setting up'}
            </Title>
            {!setupErr ? (
              <Col gap={14} padding={{ top: 24 }} align="center">
                <Spinner size={28} color={pal.primary} />
                <Text size="md" color={pal.text}>{STAGE_LABELS[stage]}</Text>
                <Text size="xs" color={pal.sub} style={{ textAlign: 'center' }}>
                  {stage === 'messaging'
                    ? 'Registering your encrypted inbox. This can take up to a minute on first launch.'
                    : 'This only takes a moment.'}
                </Text>
                {/* Stepwise progress so the stage is always legible, not just a label. */}
                <Col gap={4} padding={{ top: 8 }}>
                  {(['wallet', 'messaging', 'finishing'] as Stage[]).map((s, i) => {
                    const order: Stage[] = ['wallet', 'messaging', 'finishing'];
                    const done = order.indexOf(stage) > i;
                    const active = stage === s;
                    return (
                      <Text key={s} size="sm" color={active ? pal.text : done ? pal.sub : pal.border}>
                        {done ? '✓ ' : active ? '• ' : '· '}{STAGE_LABELS[s]}
                      </Text>
                    );
                  })}
                </Col>
              </Col>
            ) : (
              <Text size="sm" color={pal.sub} style={{ marginTop: 8 }}>
                {setupErr.accountId
                  ? 'Your wallet is ready, but secure messaging did not finish setting up. Try again - your wallet and recovery phrase are safe.'
                  : 'We could not finish setting up. ' + setupErr.message}
              </Text>
            )}
          </Box>
          {setupErr ? (
            <Col gap={10}>
              <Button
                dark={dark} variant="primary" size="lg" fullWidth
                tintBg={pal.primary} tintFg={pal.bg}
                label="Try again" disabled={busy}
                onPress={() => {
                  if (setupErr.accountId) retryMessaging(setupErr.accountId);
                  else if (pending) run(pending, false);
                  else { setSetupErr(null); setStep('welcome'); }
                }}
              />
              {!setupErr.accountId ? (
                <Button
                  dark={dark} variant="ghost" size="lg" fullWidth
                  label="Back" disabled={busy}
                  onPress={() => { setSetupErr(null); setPending(null); setStep('welcome'); }}
                />
              ) : null}
            </Col>
          ) : null}
        </Col>
      ) : null}
    </Col>
  );
}
