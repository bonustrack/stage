import { useState } from 'react';
import { usePathname } from 'expo-router';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { passkeysAvailable } from '../../lib/zerodev';
import { abandonAccount, confirmRestoredPasskey, inspectPhrase, PasskeySetupError, type PasskeyChoice, type PasskeyMode, type Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { useSetupRunner, type Choice } from './useSetupRunner';
import { IMPORT_ROUTE } from './nextRoute.model';
import { EMPTY_DETAILS, profileSetupFrom, type ProfileDetails } from './Onboarding.profile.model';

export type Step = 'username' | 'profile' | 'import' | 'passkey' | 'setup';

export interface OnboardingFlow {
  step: Step;
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  passkeyMode: PasskeyMode;
  passkeyErr: string | null;
  onUsernameContinue: (label: string) => void;
  onProfileContinue: (details: ProfileDetails) => void;
  onProfileSkip: () => void;
  onProfileBack: () => void;
  onImportTransfer: (transfer: AccountTransfer) => void;
  onAddPasskey: () => void;
  onSkipPasskey: () => void;
  onPasskeyBack: () => void;
  onSkipHistory: () => void;
  onSetupRetry: () => void;
  onSetupBack: () => void;
}

function createChoice(label: string, details: ProfileDetails): Choice {
  const profile = profileSetupFrom(label, details);
  return profile === null ? { kind: 'create' } : { kind: 'create', profile };
}

export function useOnboardingFlow(onDone: () => void): OnboardingFlow {
  const [flowStep, setStep] = useState<Step>('username');
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState<Choice | null>(null);
  const [passkeyMode, setPasskeyMode] = useState<PasskeyMode>('add');
  const [inspecting, setInspecting] = useState(false);
  const [passkeyErr, setPasskeyErr] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const runner = useSetupRunner(onDone);
  const atImportRoute = usePathname() === IMPORT_ROUTE;
  const step: Step = flowStep === 'username' && atImportRoute ? 'import' : flowStep;

  const start = (choice: Choice, passkey: PasskeyChoice): void => {
    setStep('setup');
    runner.run(choice, passkey);
  };

  const toPasskey = (choice: Choice, mode: PasskeyMode): void => {
    setPending(choice);
    if (!passkeysAvailable()) { start(choice, 'none'); return; }
    setPasskeyMode(mode);
    setStep('passkey');
  };

  const importPhrase = async (phrase: string): Promise<void> => {
    const choice: Choice = { kind: 'restore', phrase };
    setInspecting(true);
    try {
      const found = await inspectPhrase(phrase);
      if (found.alreadyImported) { start(choice, 'none'); return; }
      toPasskey(choice, found.passkeyRequired ? 'verify' : 'add');
    } catch {
      toPasskey(choice, 'add');
    } finally {
      setInspecting(false);
    }
  };

  const onImportTransfer = (transfer: AccountTransfer): void => {
    if (transfer.kind === 'phrase') void importPhrase(transfer.phrase);
    else start({ kind: 'importKey', pk: transfer.pk }, 'none');
  };

  const confirmPasskey = async (phrase: string): Promise<void> => {
    setInspecting(true);
    setPasskeyErr(null);
    try {
      const accountId = await confirmRestoredPasskey(phrase);
      setRestoredId(null);
      start({ kind: 'restored', accountId }, 'verify');
    } catch (e) {
      if (e instanceof PasskeySetupError) setRestoredId(e.accountId);
      setPasskeyErr((e as Error).message);
    } finally {
      setInspecting(false);
    }
  };

  const onAddPasskey = (): void => {
    if (!pending) return;
    if (passkeyMode === 'verify' && pending.kind === 'restore') { void confirmPasskey(pending.phrase); return; }
    start(pending, passkeyMode);
  };

  const startOver = (): void => {
    if (restoredId !== null) void abandonAccount(restoredId).catch(() => undefined);
    runner.startOver();
    setRestoredId(null); setPasskeyErr(null); setPending(null); setLabel('');
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
    busy: runner.busy || inspecting, stage: runner.stage, setupErr: runner.setupErr, plan: runner.plan,
    passkeyMode, passkeyErr,
    onUsernameContinue: (next) => { setLabel(next); if (next === '') toPasskey({ kind: 'create' }, 'add'); else setStep('profile'); },
    onProfileContinue: (details) => { toPasskey(createChoice(label, details), 'add'); },
    onProfileSkip: () => { toPasskey(createChoice(label, EMPTY_DETAILS), 'add'); },
    onProfileBack: () => { setStep('username'); },
    onImportTransfer,
    onAddPasskey,
    onSkipPasskey: () => { if (pending && passkeyMode === 'add') start(pending, 'none'); },
    onPasskeyBack: () => { setPasskeyErr(null); setStep(label === '' ? 'username' : 'profile'); },
    onSkipHistory: runner.skipHistory,
    onSetupRetry,
    onSetupBack: startOver,
  };
}
