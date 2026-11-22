import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { errorMessage } from '@stage-labs/client/errors';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { holdOnboarding } from '../../lib/accountGate';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { report, reported } from '../../lib/errorPolicy';
import { ownedStageLabel } from '../../lib/mailKey';
import type { EditableProfile } from '../../lib/onboarding.core';
import { pickSignInWallet } from '../../lib/externalWallet';
import { privyReturnHandled, returnedPrivyLogin, returnedPrivyMethod } from '../../lib/privyBridge';
import { SignInCancelled } from '../../lib/signInCancelled';
import type { ProfileSetup } from './Onboarding.profile.model';
import type { Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { useSetupRunner, type Choice, type HistoryControls } from './useSetupRunner';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from './nextRoute.model';
import { EMPTY_DETAILS, profileSetupFrom, type ProfileDetails } from './Onboarding.profile.model';

export type Step = 'signup' | 'username' | 'profile' | 'import' | 'setup' | 'edit' | 'claim' | 'emailCode';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  emailSentTo: string | null;
  onEmailCodeSent: (email: string) => void;
  onEmailCodeBack: () => void;
  onEmailSignedIn: (address: string) => void;
  onImportBack: () => void;
  onCreate: () => void;
  onUsernameContinue: (label: string) => void;
  onUsernameBack: () => void;
  onProfileContinue: (details: ProfileDetails) => void;
  onProfileSkip: () => void;
  onProfileBack: () => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onPrivy: (method: PrivyLoginMethod) => void;
  onClaimDone: () => void;
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

function useReturnedSignIn(resume: (method: PrivyLoginMethod) => void, giveUp: () => void): void {
  const handled = useRef(false);
  useEffect(() => {
    const method = returnedPrivyMethod();
    if (method === null || handled.current) return;
    handled.current = true;
    void returnedPrivyLogin()
      .then((pending) => {
        if (pending?.purpose === 'reauth') {
          giveUp();
          return;
        }
        privyReturnHandled();
        resume(pending?.method ?? method);
      })
      .catch(reported('onboarding.privyReturn'));
  });
}

async function needsUsername(): Promise<boolean> {
  const rec = await getActiveAccount();
  return rec?.type === 'privy' && (await ownedStageLabel(rec.address)) === null;
}

function afterSetup(onDone: () => void, claim: () => void): () => void {
  return () => {
    void needsUsername()
      .then((needed) => {
        if (needed) claim();
        else onDone();
      })
      .catch((err: unknown) => {
        report('onboarding.nameCheck', err);
        onDone();
      });
  };
}

function signInFailed(err: unknown): void {
  if (!(err instanceof SignInCancelled)) capabilities.toast(errorMessage(err));
}

function privyStarter(start: (choice: Choice) => void, onCreate: () => void): (method: PrivyLoginMethod) => void {
  return (method) => {
    if (method !== 'wallet') {
      start({ kind: 'privy', method });
      return;
    }
    void pickSignInWallet()
      .then((picked) => {
        if (picked.kind === 'create') onCreate();
        else if (picked.kind === 'import') capabilities.navigate(IMPORT_ROUTE);
        else start({ kind: 'privy', method, address: picked.address });
      })
      .catch(signInFailed);
  };
}

type EmailHandlers = Pick<OnboardingFlow, 'onEmailCodeSent' | 'onEmailCodeBack' | 'onEmailSignedIn' | 'onImportBack'>;

function emailHandlers(
  setEmailSentTo: (email: string | null) => void,
  setStep: (step: Step) => void,
  start: (choice: Choice) => void,
): EmailHandlers {
  return {
    onEmailCodeSent: (email) => {
      setEmailSentTo(email);
      setStep('emailCode');
    },
    onEmailCodeBack: () => {
      setEmailSentTo(null);
      setStep('signup');
    },
    onEmailSignedIn: (address) => {
      start({ kind: 'privy', method: 'email', address });
    },
    onImportBack: () => {
      capabilities.navigate(SIGNUP_ROUTE);
    },
  };
}

type RecoveryHandlers = Pick<OnboardingFlow, 'onSetupEdit' | 'onRecoverySave' | 'onRecoveryBack'>;

function recoveryHandlers(
  editableProfile: () => Promise<EditableProfile | null>,
  setProfileRecovery: (value: EditableProfile | null) => void,
  setStep: (step: Step) => void,
  start: (choice: Choice) => void,
): RecoveryHandlers {
  return {
    onSetupEdit: () => {
      void editableProfile().then((value) => {
        if (value === null) return;
        setProfileRecovery(value);
        setStep('edit');
      });
    },
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

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [flowStep, setStep] = useState<Step>(() => (returnedPrivyMethod() === null ? 'signup' : 'setup'));
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState<Choice | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [profileRecovery, setProfileRecovery] = useState<EditableProfile | null>(null);
  const claim = (): void => {
    holdOnboarding(true);
    setStep('claim');
  };
  const runner = useSetupRunner(afterSetup(onDone, claim), () => {
    setPending(null);
    setStep('signup');
  });
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const showsSetup = runner.recovering && flowStep !== 'edit' && flowStep !== 'claim';
  const step: Step = showsSetup ? 'setup' : flowStep === 'signup' && atImportRoute ? 'import' : flowStep;

  const start = (choice: Choice): void => {
    setPending(choice);
    setStep('setup');
    runner.run(choice);
  };

  useReturnedSignIn(
    (method) => {
      start({ kind: 'privy', method });
    },
    () => {
      setStep('signup');
    },
  );

  const startOver = (): void => {
    void runner.startOver().then((cleared) => {
      if (!cleared) return;
      setPending(null);
      setLabel('');
      setStep('signup');
    });
  };

  const onSetupRetry = (): void => {
    const err = runner.setupErr;
    if (err !== null && (err.retry === 'create' || (err.retry === 'messaging' && err.accountId !== undefined))) runner.resume(err);
    else if (pending) start(pending);
    else {
      runner.reset();
      setStep('signup');
    }
  };

  return {
    step,
    busy: runner.busy,
    stage: runner.stage,
    setupErr: runner.setupErr,
    plan: runner.plan,
    emailSentTo,
    ...emailHandlers(setEmailSentTo, setStep, start),
    onCreate: () => {
      setStep('username');
    },
    onUsernameContinue: (next) => {
      setLabel(next);
      if (next === '') start({ kind: 'create' });
      else setStep('profile');
    },
    onUsernameBack: () => {
      setStep('signup');
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
    onPrivy: privyStarter(start, () => {
      setStep('username');
    }),
    onClaimDone: () => {
      holdOnboarding(false);
      onDone();
    },
    history: runner.history,
    onSetupRetry,
    onSetupBack: startOver,
    profileRecovery,
    ...recoveryHandlers(runner.editableProfile, setProfileRecovery, setStep, start),
  };
}
