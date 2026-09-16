import { useState } from 'react';
import { usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import type { Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { useSetupRunner, type Choice } from './useSetupRunner';
import { IMPORT_ROUTE } from './nextRoute.model';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Step = 'profile' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  onProfileContinue: (profile: ProfileSetup | null) => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onSkipHistory: () => void;
  onSetupRetry: () => void;
  onSetupBack: () => void;
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [flowStep, setStep] = useState<Step>('profile');
  const [pending, setPending] = useState<Choice | null>(null);
  const runner = useSetupRunner(onDone);
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const step: Step = flowStep === 'profile' && atImportRoute ? 'import' : flowStep;

  const start = (choice: Choice, withPasskey: boolean): void => {
    setStep('setup');
    runner.run(choice, withPasskey);
  };

  const toPasskey = (choice: Choice): void => {
    setPending(choice);
    if (!passkeysAvailable()) { start(choice, false); return; }
    setStep('passkey');
  };

  const onImportTransfer = (transfer: AccountTransfer): void => {
    if (transfer.kind === 'phrase') toPasskey({ kind: 'restore', phrase: transfer.phrase });
    else start({ kind: 'importKey', pk: transfer.pk }, false);
  };

  const onSetupRetry = (): void => {
    const err = runner.setupErr;
    if (err?.accountId !== undefined && err.retry !== 'restart') runner.resume(err.accountId, err.retry);
    else if (pending) start(pending, false);
    else { runner.reset(); setStep('profile'); }
  };

  return {
    step,
    busy: runner.busy, stage: runner.stage, setupErr: runner.setupErr, plan: runner.plan,
    onProfileContinue: (profile) => { toPasskey(profile === null ? { kind: 'create' } : { kind: 'create', profile }); },
    onImportTransfer,
    onAddPasskey: () => { if (pending) start(pending, true); },
    onSkipPasskey: () => { if (pending) start(pending, false); },
    onSkipHistory: runner.skipHistory,
    onSetupRetry,
    onSetupBack: () => { runner.startOver(); setPending(null); setStep('profile'); },
  };
}
