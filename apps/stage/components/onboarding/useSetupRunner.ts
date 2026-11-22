import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { holdOnboarding } from '../../lib/accountGate';
import { report } from '../../lib/errorPolicy';
import { SignInCancelled } from '../../lib/signInCancelled';
import { AccountSetupError, type EditableProfile } from '../../lib/onboarding.core';
import { clearPendingSetup, readPendingSetup } from '../../lib/onboardingPending';
import { syncHistoryToEnd } from '../../lib/history';
import { historySyncSettled } from '../../lib/history.model';
import {
  createWallet,
  resumeCreatedWallet,
  resumeSavedSetup,
  editableCreatedProfile,
  editCreatedProfile,
  restoreWallet,
  importKeyAccount,
  signInWithPrivy,
  bringMessagingOnline,
  XmtpSetupError,
  type SetupWarning,
  type Stage,
} from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import type { ProfileSetup } from './Onboarding.profile.model';
import {
  heldSetupWarning,
  historyStalled,
  holdWarning,
  onSetupCancel,
  onSetupDone,
  resetSetupState,
  setupBusy,
  setupCancelled,
  setupDone,
  setupError,
  setupPlan,
  setupRunning,
  setupStage,
} from './setupState';

export type Choice =
  | { kind: 'create'; profile?: ProfileSetup }
  | { kind: 'editProfile'; profile: ProfileSetup }
  | { kind: 'restore'; phrase: string }
  | { kind: 'importKey'; pk: Hex }
  | { kind: 'privy'; method: PrivyLoginMethod; address?: string };

export interface SetupRunner {
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  run: (choice: Choice) => void;
  recovering: boolean;
  resume: (err: SetupErr) => void;
  startOver: () => Promise<boolean>;
  editableProfile: () => Promise<EditableProfile | null>;
  history: HistoryControls;
  reset: () => void;
}
export interface HistoryControls {
  stalled: boolean;
  retry: () => void;
  continueWithout: () => void;
}

function describe(e: unknown): string {
  return txErrorMessage(e, 'Something went wrong.');
}
function errorFrom(e: unknown): SetupErr {
  if (e instanceof AccountSetupError) return { message: describe(e), accountId: e.accountId, retry: 'create' };
  if (e instanceof XmtpSetupError) return { message: e.message, accountId: e.accountId, retry: 'messaging' };
  return { message: describe(e), retry: 'restart' };
}
async function assertNoSavedSetup(): Promise<void> {
  const pending = await readPendingSetup();
  if (pending === null) return;
  throw new AccountSetupError(pending.stage, pending.account?.id, new Error('Continue the saved account setup instead of replacing it.'));
}

function planFor(choice: Choice): SetupPlan {
  if (choice.kind === 'privy') return { signIn: choice.method };
  const restore = choice.kind === 'restore' || choice.kind === 'importKey';
  const profile = (choice.kind === 'create' || choice.kind === 'editProfile') && choice.profile !== undefined;
  return { restore, profile, history: restore };
}

async function runChoice(choice: Choice): Promise<SetupWarning> {
  const onStage = setupStage.set;
  if (choice.kind === 'privy') return signInWithPrivy(choice.method, onStage, choice.address);
  if (choice.kind === 'create') return createWallet(onStage, choice.profile);
  if (choice.kind === 'editProfile') {
    await editCreatedProfile(choice.profile);
    return resumeCreatedWallet(onStage);
  }
  if (choice.kind === 'restore') return restoreWallet(choice.phrase, onStage);
  return importKeyAccount(choice.pk, onStage);
}

function finish(warning: SetupWarning): void {
  setupRunning.set(false);
  setupBusy.set(false);
  holdOnboarding(false);
  setupDone(warning);
}

async function tail(sync: boolean, warning: SetupWarning): Promise<void> {
  if (sync) {
    setupStage.set('history');
    historyStalled.set(false);
    if (!historySyncSettled(await syncHistoryToEnd())) {
      holdWarning(warning);
      historyStalled.set(true);
      return;
    }
  }
  setupStage.set('finishing');
  finish(warning);
}

const history: Omit<HistoryControls, 'stalled'> = {
  retry: () => {
    if (historyStalled.get()) void tail(true, heldSetupWarning());
  },
  continueWithout: () => {
    if (!historyStalled.get()) return;
    historyStalled.set(false);
    setupStage.set('finishing');
    finish(heldSetupWarning());
  },
};

function execute(work: () => Promise<SetupWarning>, sync: () => boolean, first: Stage): void {
  if (setupBusy.get()) return;
  holdOnboarding(true);
  setupRunning.set(true);
  setupBusy.set(true);
  setupError.set(null);
  setupStage.set(first);
  void work()
    .then((warning) => tail(sync(), warning))
    .catch((e: unknown) => {
      setupRunning.set(false);
      setupBusy.set(false);
      if (e instanceof SignInCancelled) {
        holdOnboarding(false);
        setupCancelled();
        return;
      }
      report('onboarding.setup', e);
      setupError.set(errorFrom(e));
    });
}

function interrupted(message: string, accountId?: string): void {
  holdOnboarding(true);
  setupError.set({ retry: 'create', accountId, message });
}

function useSetupRecovery(): { initializing: boolean; recovering: boolean; reset: () => void } {
  const [initializing, setInitializing] = useState(true);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let alive = true;
    if (setupRunning.get()) {
      setRecovering(true);
      setInitializing(false);
      return;
    }
    resetSetupState();
    void readPendingSetup()
      .then((pending) => {
        if (!alive || pending === null) return;
        setRecovering(true);
        setupPlan.set({ profile: pending.profile !== undefined });
        setupStage.set(pending.stage);
        interrupted('Setup was interrupted before it finished.', pending.account?.id);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRecovering(true);
        interrupted(describe(e));
      })
      .finally(() => {
        if (alive) setInitializing(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return {
    initializing,
    recovering,
    reset: () => {
      setRecovering(false);
    },
  };
}

function reset(): void {
  setupError.set(null);
  holdOnboarding(false);
}

async function startOverFrom(err: SetupErr | null): Promise<boolean> {
  if (setupBusy.get() || err?.retry !== 'restart') return false;
  try {
    await assertNoSavedSetup();
    await clearPendingSetup();
    reset();
    return true;
  } catch (e) {
    setupError.set(errorFrom(e));
    return false;
  }
}

async function editableProfileOf(err: SetupErr | null): Promise<EditableProfile | null> {
  if (setupBusy.get()) return null;
  setupBusy.set(true);
  try {
    return await editableCreatedProfile();
  } catch (e) {
    setupError.set({ retry: 'create', accountId: err?.accountId, message: describe(e) });
    return null;
  } finally {
    setupBusy.set(false);
  }
}

export function useSetupRunner(onDone: () => void, onCancel: () => void): SetupRunner {
  const busy = setupBusy.use();
  const stage = setupStage.use();
  const setupErr = setupError.use();
  const plan = setupPlan.use();
  const stalled = historyStalled.use();
  const recovery = useSetupRecovery();
  useEffect(() => onSetupDone(onDone), [onDone]);
  useEffect(() => onSetupCancel(onCancel), [onCancel]);
  const run = (choice: Choice): void => {
    if (setupBusy.get()) return;
    const next = planFor(choice);
    setupPlan.set(next);
    execute(
      () => runChoice(choice),
      () => next.history === true,
      'wallet',
    );
  };
  const resume = (err: SetupErr): void => {
    execute(
      async () => {
        if (err.retry === 'create') return resumeSavedSetup(err.accountId, setupStage.set);
        if (err.accountId !== undefined) await bringMessagingOnline(err.accountId, setupStage.set);
        return null;
      },
      () => setupPlan.get().history === true,
      'messaging',
    );
  };
  return {
    busy: busy || recovery.initializing,
    recovering: recovery.recovering,
    stage,
    setupErr,
    plan,
    run,
    resume,
    startOver: async () => {
      const cleared = await startOverFrom(setupErr);
      if (cleared) recovery.reset();
      return cleared;
    },
    editableProfile: () => editableProfileOf(setupErr),
    history: { stalled, ...history },
    reset,
  };
}
