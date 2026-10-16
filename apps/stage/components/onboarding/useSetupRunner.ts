import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Hex } from 'viem';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import { holdOnboarding } from '../../lib/accountGate';
import { AccountSetupError, type EditableProfile } from '../../lib/onboarding.core';
import { clearPendingSetup, readPendingSetup } from '../../lib/onboardingPending';
import { syncHistoryToEnd } from '../../lib/history';
import {
  createWallet, resumeCreatedWallet, editableCreatedProfile, editCreatedProfile, restoreWallet, importKeyAccount, bringMessagingOnline, XmtpSetupError,
  type SetupWarning, type Stage,
} from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Choice =
  | { kind: 'create'; profile?: ProfileSetup }
  | { kind: 'editProfile'; profile: ProfileSetup }
  | { kind: 'restore'; phrase: string }
  | { kind: 'importKey'; pk: Hex };

export interface SetupRunner {
  busy: boolean; stage: Stage; setupErr: SetupErr | null; plan: SetupPlan;
  run: (choice: Choice) => void; recovering: boolean; resume: (accountId?: string) => void;
  startOver: () => Promise<boolean>; editableProfile: () => Promise<EditableProfile | null>;
  history: HistoryControls; reset: () => void;
}
export interface HistoryControls { stalled: boolean; retry: () => void; continueWithout: () => void }

function describe(e: unknown): string { return txErrorMessage(e, 'Something went wrong.'); }
function errorFrom(e: unknown): SetupErr {
  if (e instanceof AccountSetupError) return { message: describe(e), accountId: e.accountId, retry: 'create' };
  if (e instanceof XmtpSetupError) return { message: e.message, accountId: e.accountId, retry: 'messaging' };
  return { message: describe(e), retry: 'restart' };
}
async function runChoice(choice: Choice, onStage: (s: Stage) => void): Promise<SetupWarning> {
  if (choice.kind === 'create') return createWallet(onStage, choice.profile);
  if (choice.kind === 'editProfile') { await editCreatedProfile(choice.profile); return resumeCreatedWallet(onStage); }
  if (choice.kind === 'restore') return restoreWallet(choice.phrase, onStage);
  return importKeyAccount(choice.pk, onStage);
}
function useLatch(): [boolean, (next: boolean) => void, () => boolean] {
  const [value, setValueState] = useState(false);
  const latched = useRef(false);
  const setValue = (next: boolean): void => { latched.current = next; setValueState(next); };
  return [value, setValue, () => latched.current];
}

function useSetupRecovery(
  setPlan: (plan: SetupPlan) => void, setStage: (stage: Stage) => void, setError: (err: SetupErr | null) => void,
): { initializing: boolean; recovering: boolean; reset: () => void } {
  const [initializing, setInitializing] = useState(true);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let alive = true;
    void readPendingSetup().then((pending) => {
      if (!alive || pending === null) return;
      setRecovering(true);
      holdOnboarding(true);
      setPlan({ profile: pending.profile !== undefined });
      setStage(pending.stage);
      setError({ retry: 'create', accountId: pending.account?.id, message: 'Setup was interrupted before it finished.' });
    }).catch((e: unknown) => {
      if (!alive) return;
      setRecovering(true);
      holdOnboarding(true);
      setError({ retry: 'create', message: describe(e) });
    }).finally(() => { if (alive) setInitializing(false); });
    return () => { alive = false; };
  }, [setPlan, setStage, setError]);
  return { initializing, recovering, reset: () => { setRecovering(false); } };
}

function useCompletion(onDone: () => void): (warning: SetupWarning) => void {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return (warning) => {
    if (!mounted.current) return;
    onDone();
    if (warning !== null) Alert.alert(warning.title, warning.message);
  };
}

function useHistoryTail(setStage: (stage: Stage) => void, finish: (warning: SetupWarning) => void): {
  tail: (sync: boolean, warning: SetupWarning) => Promise<void>; history: HistoryControls;
} {
  const [stalled, setStalled, isStalled] = useLatch();
  const heldWarning = useRef<SetupWarning>(null);
  const tail = async (sync: boolean, warning: SetupWarning): Promise<void> => {
    if (sync) {
      setStage('history'); setStalled(false);
      if ((await syncHistoryToEnd()) !== 'done') { heldWarning.current = warning; setStalled(true); return; }
    }
    setStage('finishing'); finish(warning);
  };
  return {
    tail,
    history: {
      stalled,
      retry: () => { if (isStalled()) void tail(true, heldWarning.current); },
      continueWithout: () => { if (isStalled()) { setStalled(false); setStage('finishing'); finish(heldWarning.current); } },
    },
  };
}

export function useSetupRunner(onDone: () => void): SetupRunner {
  const [busy, setBusy, isBusy] = useLatch();
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<SetupErr | null>(null);
  const [plan, setPlan] = useState<SetupPlan>({});
  const recovery = useSetupRecovery(setPlan, setStage, setSetupErr);
  const complete = useCompletion(onDone);
  const finish = (warning: SetupWarning): void => { holdOnboarding(false); setBusy(false); complete(warning); };
  const { tail, history } = useHistoryTail(setStage, finish);
  const reset = (): void => { setSetupErr(null); holdOnboarding(false); };
  const execute = (work: () => Promise<SetupWarning>, sync: boolean, first: Stage): void => {
    if (isBusy()) return;
    holdOnboarding(true); setBusy(true); setSetupErr(null); setStage(first);
    void work().then(warning => tail(sync, warning)).catch((e: unknown) => { setBusy(false); setSetupErr(errorFrom(e)); });
  };
  const run = (choice: Choice): void => {
    if (isBusy()) return;
    const restore = choice.kind === 'restore' || choice.kind === 'importKey';
    setPlan({ restore, profile: (choice.kind === 'create' || choice.kind === 'editProfile') && choice.profile !== undefined, history: restore });
    execute(() => runChoice(choice, setStage), restore, 'wallet');
  };
  const resume = (accountId?: string): void => {
    execute(async () => {
      if (accountId === undefined) return resumeCreatedWallet(setStage);
      await bringMessagingOnline(accountId, setStage);
      return null;
    }, plan.history === true, 'messaging');
  };
  const startOver = async (): Promise<boolean> => {
    if (isBusy() || setupErr?.retry !== 'restart') return false;
    try {
      const pending = await readPendingSetup();
      if (pending !== null) throw new AccountSetupError(pending.stage, pending.account?.id, new Error('Continue the saved account setup instead of replacing it.'));
      await clearPendingSetup(); recovery.reset(); reset(); return true;
    } catch (e) { setSetupErr(errorFrom(e)); return false; }
  };
  const editableProfile = async (): Promise<EditableProfile | null> => {
    if (isBusy()) return null;
    setBusy(true);
    try { return await editableCreatedProfile(); } catch (e) {
      setSetupErr({ retry: 'create', accountId: setupErr?.accountId, message: describe(e) }); return null;
    } finally { setBusy(false); }
  };
  return { busy: busy || recovery.initializing, recovering: recovery.recovering, stage, setupErr, plan, run, resume, startOver, editableProfile, history, reset };
}
