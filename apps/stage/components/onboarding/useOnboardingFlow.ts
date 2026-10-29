import { useState } from 'react';
import { usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import type { EditableProfile } from '../../lib/onboarding.core';
import type { ProfileSetup } from './Onboarding.profile.model';
import type { Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { useSetupRunner, type Choice, type HistoryControls } from './useSetupRunner';
import { IMPORT_ROUTE } from './nextRoute.model';
import { EMPTY_DETAILS, profileSetupFrom, type ProfileDetails } from './Onboarding.profile.model';

export type Step = 'username' | 'profile' | 'import' | 'setup' | 'edit';

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
  history: HistoryControls;
  onSetupRetry: () => void;
  onSetupBack: () => void;
  onSetupEdit: () => void;
  profileRecovery: EditableProfile | null;
  onRecoverySave: (profile: ProfileSetup) => void;
  onRecoveryBack: () => void;
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
  const [profileRecovery, setProfileRecovery] = useState<EditableProfile | null>(null);
  const runner = useSetupRunner(onDone);
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const step: Step = runner.recovering && flowStep !== 'edit' ? 'setup' : flowStep === 'username' && atImportRoute ? 'import' : flowStep;

  const start = (choice: Choice): void => {
    setPending(choice);
    setStep('setup');
    runner.run(choice);
  };

  const startOver = (): void => {
    void runner.startOver().then((cleared) => {
      if (!cleared) return;
      setPending(null);
      setLabel('');
      setStep('username');
    });
  };

  const onSetupRetry = (): void => {
    const err = runner.setupErr;
    if (err?.retry === 'create') runner.resume();
    else if (err?.accountId !== undefined && err.retry === 'messaging') runner.resume(err.accountId);
    else if (pending) start(pending);
    else {
      runner.reset();
      setStep('username');
    }
  };

  return {
    step,
    busy: runner.busy,
    stage: runner.stage,
    setupErr: runner.setupErr,
    plan: runner.plan,
    onUsernameContinue: (next) => {
      setLabel(next);
      if (next === '') start({ kind: 'create' });
      else setStep('profile');
    },
    onProfileContinue: (details) => {
      start(createChoice(label, details));
    },
    onProfileSkip: () => {
      start(createChoice(label, EMPTY_DETAILS));
    },
    onProfileBack: () => {
      setStep('username');
    },
    onImportTransfer: (transfer) => {
      start(importChoice(transfer));
    },
    history: runner.history,
    onSetupRetry,
    onSetupBack: startOver,
    onSetupEdit: () => {
      void runner.editableProfile().then((value) => {
        if (value !== null) {
          setProfileRecovery(value);
          setStep('edit');
        }
      });
    },
    profileRecovery,
    onRecoverySave: (profile) => {
      setProfileRecovery(null);
      start({ kind: 'editProfile', profile });
    },
    onRecoveryBack: () => {
      setProfileRecovery(null);
      setStep('setup');
    },
  };
}
