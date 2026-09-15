import { useState } from 'react';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import type { Stage } from './flow';
import type { SetupErr } from './Onboarding.setup.model';
import { useSetupRunner, type Choice } from './useSetupRunner';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from './nextRoute.model';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Step = 'welcome' | 'profile' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  withHistory: boolean;
  withProfile: boolean;
  onCreate: () => void;
  onLeave: () => void;
  onProfileContinue: (profile: ProfileSetup | null) => void;
  onProfileBack: () => void;
  onImport: () => void;
  onImportBack: () => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onSkipHistory: () => void;
  onSetupRetry: () => void;
  onSetupBack: () => void;
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [flowStep, setStep] = useState<Step>('welcome');
  const [pending, setPending] = useState<Choice | null>(null);
  const runner = useSetupRunner(onDone);
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const { next } = useGlobalSearchParams<{ next?: string }>();
  const step: Step = flowStep === 'welcome' && atImportRoute ? 'import' : flowStep;

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
    const accountId = runner.setupErr?.accountId;
    if (accountId !== undefined) runner.retryMessaging(accountId);
    else if (pending) start(pending, false);
    else { runner.reset(); setStep('welcome'); }
  };

  return {
    step,
    busy: runner.busy, stage: runner.stage, setupErr: runner.setupErr, withHistory: runner.withHistory,
    withProfile: runner.withProfile,
    onCreate: () => { setStep('profile'); },
    onLeave: () => { if (router.canGoBack()) router.back(); else router.replace('/'); },
    onProfileContinue: (profile) => { toPasskey(profile === null ? { kind: 'create' } : { kind: 'create', profile }); },
    onProfileBack: () => { setStep('welcome'); },
    onImport: () => { router.push({ pathname: IMPORT_ROUTE, params: next === undefined ? {} : { next } }); },
    onImportBack: () => { if (router.canGoBack()) router.back(); else router.replace(SIGNUP_ROUTE); },
    onImportTransfer,
    onAddPasskey: () => { if (pending) start(pending, true); },
    onSkipPasskey: () => { if (pending) start(pending, false); },
    onSkipHistory: runner.skipHistory,
    onSetupRetry,
    onSetupBack: () => { runner.reset(); setPending(null); setStep('welcome'); },
  };
}
