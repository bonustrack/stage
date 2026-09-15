import { useState } from 'react';
import { router, usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import type { Stage } from './flow';
import type { SetupErr } from './Onboarding.setup.model';
import { useSetupRunner, type Choice } from './useSetupRunner';
import { IMPORT_ROUTE } from './nextRoute.model';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Step = 'profile' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  withHistory: boolean;
  withProfile: boolean;
  onProfileContinue: (profile: ProfileSetup | null) => void;
  onProfileBack: () => void;
  onImportBack: () => void;
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

  const leave = (): void => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  const onSetupRetry = (): void => {
    const accountId = runner.setupErr?.accountId;
    if (accountId !== undefined) runner.retryMessaging(accountId);
    else if (pending) start(pending, false);
    else { runner.reset(); setStep('profile'); }
  };

  return {
    step,
    busy: runner.busy, stage: runner.stage, setupErr: runner.setupErr, withHistory: runner.withHistory,
    withProfile: runner.withProfile,
    onProfileContinue: (profile) => { toPasskey(profile === null ? { kind: 'create' } : { kind: 'create', profile }); },
    onProfileBack: leave,
    onImportBack: leave,
    onImportTransfer,
    onAddPasskey: () => { if (pending) start(pending, true); },
    onSkipPasskey: () => { if (pending) start(pending, false); },
    onSkipHistory: runner.skipHistory,
    onSetupRetry,
    onSetupBack: () => { runner.reset(); setPending(null); setStep('profile'); },
  };
}
