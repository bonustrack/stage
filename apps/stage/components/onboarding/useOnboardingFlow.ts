import { useState } from 'react';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import type { Stage } from './flow';
import type { SetupErr } from './Onboarding.setup.model';
import { useSetupRunner, type Choice } from './useSetupRunner';

export type Step = 'welcome' | 'restore' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  phrase: string;
  err: string;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  withHistory: boolean;
  onCreate: () => void;
  onRestore: () => void;
  onPhraseChange: (t: string) => void;
  onRestoreNext: () => void;
  onRestoreBack: () => void;
  onImport: () => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onSkipHistory: () => void;
  onSetupRetry: () => void;
  onSetupBack: () => void;
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [step, setStep] = useState<Step>('welcome');
  const [phrase, setPhrase] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<Choice | null>(null);
  const runner = useSetupRunner(onDone);

  const start = (choice: Choice, withPasskey: boolean): void => {
    setStep('setup');
    runner.run(choice, withPasskey);
  };

  const toPasskey = (choice: Choice): void => {
    setPending(choice);
    if (!passkeysAvailable()) { start(choice, false); return; }
    setStep('passkey');
  };

  const onRestoreNext = (): void => {
    const p = phrase.trim();
    if (!p) { setErr('Enter your recovery phrase.'); return; }
    setErr('');
    toPasskey({ kind: 'restore', phrase: p });
  };

  const onImportTransfer = (transfer: AccountTransfer): void => {
    if (transfer.kind === 'phrase') toPasskey({ kind: 'restore', phrase: transfer.phrase });
    else start({ kind: 'importKey', pk: transfer.pk }, false);
  };

  const onSetupRetry = (): void => {
    const accountId = runner.setupErr?.accountId;
    if (accountId !== undefined) runner.retryMessaging(accountId);
    else if (pending) start(pending, false);
    else { runner.reset(); setStep('welcome'); }
  };

  return {
    step, phrase, err,
    busy: runner.busy, stage: runner.stage, setupErr: runner.setupErr, withHistory: runner.withHistory,
    onCreate: () => { toPasskey({ kind: 'create' }); },
    onRestore: () => { setErr(''); setStep('restore'); },
    onPhraseChange: (t) => { setPhrase(t); setErr(''); },
    onRestoreNext,
    onRestoreBack: () => { setErr(''); setStep('welcome'); },
    onImport: () => { setStep('import'); },
    onImportTransfer,
    onAddPasskey: () => { if (pending) start(pending, true); },
    onSkipPasskey: () => { if (pending) start(pending, false); },
    onSkipHistory: runner.skipHistory,
    onSetupRetry,
    onSetupBack: () => { runner.reset(); setPending(null); setStep('welcome'); },
  };
}
