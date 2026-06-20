
import { useState } from 'react';
import { passkeysAvailable } from '../../lib/zerodev';
import { createWallet, restoreWallet, bringMessagingOnline, XmtpSetupError, type Stage } from './flow';
import { type SetupErr } from './Onboarding.steps';

export type Step = 'welcome' | 'restore' | 'passkey' | 'setup';

type Choice = { kind: 'create' } | { kind: 'restore'; phrase: string };

export interface OnboardingFlow {
  step: Step;
  phrase: string;
  err: string;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  onCreate: () => void;
  onRestore: () => void;
  onPhraseChange: (t: string) => void;
  onRestoreNext: () => void;
  onRestoreBack: () => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onSetupRetry: () => void;
  onSetupBack: () => void;
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [step, setStep] = useState<Step>('welcome');
  const [phrase, setPhrase] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<SetupErr | null>(null);
  const [pending, setPending] = useState<Choice | null>(null);

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
        if (e instanceof XmtpSetupError) {
          setSetupErr({ message: e.message, accountId: e.accountId });
        } else {
          setPending(null);
          setSetupErr({ message: e instanceof Error ? e.message : String(e) });
        }
      }
    })();
  };

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
        setSetupErr({ message: e instanceof Error ? e.message : String(e), accountId });
      }
    })();
  };

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

  const onSetupRetry = (): void => {
    if (setupErr?.accountId) retryMessaging(setupErr.accountId);
    else if (pending) run(pending, false);
    else { setSetupErr(null); setStep('welcome'); }
  };

  return {
    step, phrase, err, busy, stage, setupErr,
    onCreate: () => { toPasskey({ kind: 'create' }); },
    onRestore: () => { setErr(''); setStep('restore'); },
    onPhraseChange: (t) => { setPhrase(t); setErr(''); },
    onRestoreNext,
    onRestoreBack: () => { setErr(''); setStep('welcome'); },
    onAddPasskey: () => { if (pending) run(pending, true); },
    onSkipPasskey: () => { if (pending) run(pending, false); },
    onSetupRetry,
    onSetupBack: () => { setSetupErr(null); setPending(null); setStep('welcome'); },
  };
}
