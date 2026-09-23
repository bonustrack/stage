import { useState } from 'react';
import { usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import type { PasskeyChoice, Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { useSetupRunner, type Choice, type HistoryControls } from './useSetupRunner';
import { IMPORT_ROUTE } from './nextRoute.model';
import { EMPTY_DETAILS, profileSetupFrom, type ProfileDetails } from './Onboarding.profile.model';

export type Step = 'username' | 'profile' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  onUsernameContinue: (label: string) => void;
  onProfileContinue: (details: ProfileDetails) => void;
  onProfileSkip: () => void;
  onProfileBack: () => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onPasskeyBack: () => void;
  history: HistoryControls;
  onSetupRetry: () => void;
  onSetupBack: () => void;
  onSetupSkipPasskey: () => void;
}

function createChoice(label: string, details: ProfileDetails): Choice {
  const profile = profileSetupFrom(label, details);
  return profile === null ? { kind: 'create' } : { kind: 'create', profile };
}

function importChoice(transfer: AccountTransfer): Choice {
  return transfer.kind === 'phrase' ? { kind: 'restore', phrase: transfer.phrase } : { kind: 'importKey', pk: transfer.pk };
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [flowStep, setStep] = useState<Step>('username');
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState<Choice | null>(null);
  const runner = useSetupRunner(onDone);
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const step: Step = flowStep === 'username' && atImportRoute ? 'import' : flowStep;

  const start = (choice: Choice, passkey: PasskeyChoice): void => {
    setPending(choice);
    setStep('setup');
    runner.run(choice, passkey);
  };

  const toPasskey = (choice: Choice): void => {
    setPending(choice);
    if (!passkeysAvailable()) { start(choice, 'none'); return; }
    setStep('passkey');
  };

  const startOver = (): void => {
    runner.startOver();
    setPending(null); setLabel('');
    setStep('username');
  };

  const onSetupRetry = (): void => {
    const err = runner.setupErr;
    if (err?.accountId !== undefined && err.retry !== 'restart') runner.resume(err.accountId, err.retry);
    else if (pending) start(pending, 'none');
    else { runner.reset(); setStep('username'); }
  };

  return {
    step,
    busy: runner.busy, stage: runner.stage, setupErr: runner.setupErr, plan: runner.plan,
    onUsernameContinue: (next) => { setLabel(next); if (next === '') toPasskey({ kind: 'create' }); else setStep('profile'); },
    onProfileContinue: (details) => { toPasskey(createChoice(label, details)); },
    onProfileSkip: () => { toPasskey(createChoice(label, EMPTY_DETAILS)); },
    onProfileBack: () => { setStep('username'); },
    onImportTransfer: (transfer) => { start(importChoice(transfer), 'none'); },
    onAddPasskey: () => { if (pending) start(pending, 'add'); },
    onSkipPasskey: () => { if (pending) start(pending, 'none'); },
    onPasskeyBack: () => { setStep(label === '' ? 'username' : 'profile'); },
    history: runner.history,
    onSetupRetry,
    onSetupBack: startOver,
    onSetupSkipPasskey: runner.skipPasskey,
  };
}
