import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Hex } from 'viem';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import { holdOnboarding } from '../../lib/onboardingHold';
import { ONBOARDING_HISTORY_WAIT_MS, runHistorySync, waitForHistorySyncSettled } from '../../lib/historySync';
import {
  createWallet, restoreWallet, importKeyAccount, bringMessagingOnline, resumeWithPasskey, abandonAccount, XmtpSetupError, PasskeySetupError,
  type PasskeyChoice, type SetupWarning, type Stage,
} from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import { passkeysAvailable } from '../../lib/zerodev';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Choice =
  | { kind: 'create'; profile?: ProfileSetup }
  | { kind: 'restore'; phrase: string }
  | { kind: 'restored'; accountId: string }
  | { kind: 'importKey'; pk: Hex };

export interface SetupRunner {
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  run: (choice: Choice, passkey: PasskeyChoice) => void;
  resume: (accountId: string, retry: 'messaging' | 'passkey') => void;
  startOver: () => void;
  skipHistory: () => void;
  reset: () => void;
}

function errorFrom(e: unknown): SetupErr {
  if (e instanceof PasskeySetupError) return { message: e.message, accountId: e.accountId, retry: 'passkey' };
  if (e instanceof XmtpSetupError) return { message: e.message, accountId: e.accountId, retry: 'messaging' };
  return { message: describe(e), retry: 'restart' };
}

async function runChoice(choice: Choice, passkey: PasskeyChoice, onStage: (s: Stage) => void): Promise<SetupWarning> {
  if (choice.kind === 'create') return createWallet(passkey, onStage, choice.profile);
  if (choice.kind === 'restore') return restoreWallet(choice.phrase, passkey, onStage);
  if (choice.kind === 'restored') { await bringMessagingOnline(choice.accountId, onStage); return null; }
  return importKeyAccount(choice.pk, onStage);
}

function describe(e: unknown): string {
  return txErrorMessage(e, 'Something went wrong.');
}

export function useSetupRunner(onDone: () => void): SetupRunner {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<SetupErr | null>(null);
  const [plan, setPlan] = useState<SetupPlan>({});
  const skipped = useRef(false);

  const onStage = (s: Stage): void => {
    setStage(s);
    if (s === 'passkey') setPlan((p) => (p.passkey === undefined ? { ...p, passkey: 'add' } : p));
  };

  const begin = (first: Stage): void => {
    skipped.current = false;
    holdOnboarding(true);
    setBusy(true);
    setSetupErr(null);
    setStage(first);
  };

  const finish = (warning: SetupWarning): void => {
    if (skipped.current) return;
    holdOnboarding(false);
    setBusy(false);
    onDone();
    if (warning !== null) Alert.alert(warning.title, warning.message);
  };

  const tail = async (syncHistory: boolean, warning: SetupWarning): Promise<void> => {
    if (syncHistory) {
      setStage('history');
      void runHistorySync();
      await waitForHistorySyncSettled(ONBOARDING_HISTORY_WAIT_MS);
      if (skipped.current) return;
    }
    setStage('finishing');
    finish(warning);
  };

  const run = (choice: Choice, passkey: PasskeyChoice): void => {
    if (busy) return;
    const restore = choice.kind !== 'create';
    setPlan({
      restore,
      passkey: passkey !== 'none' && passkeysAvailable() ? passkey : undefined,
      profile: choice.kind === 'create' && choice.profile !== undefined,
      history: restore,
    });
    begin(choice.kind === 'restored' ? 'messaging' : 'wallet');
    void (async (): Promise<void> => {
      try {
        const warning = await runChoice(choice, passkey, onStage);
        await tail(restore, warning);
      } catch (e) {
        setBusy(false);
        setSetupErr(errorFrom(e));
      }
    })();
  };

  const resume = (accountId: string, retry: 'messaging' | 'passkey'): void => {
    if (busy) return;
    begin(retry);
    void (async (): Promise<void> => {
      try {
        if (retry === 'passkey') await resumeWithPasskey(accountId, onStage);
        else await bringMessagingOnline(accountId, onStage);
        await tail(plan.history === true, null);
      } catch (e) {
        setBusy(false);
        setSetupErr(errorFrom(e));
      }
    })();
  };

  const startOver = (): void => {
    const accountId = setupErr?.accountId;
    if (accountId !== undefined) void abandonAccount(accountId).catch(() => undefined);
    reset();
  };

  const skipHistory = (): void => {
    if (stage !== 'history') return;
    skipped.current = true;
    holdOnboarding(false);
    setBusy(false);
    onDone();
  };

  const reset = (): void => {
    setSetupErr(null);
    holdOnboarding(false);
  };

  return { busy, stage, setupErr, plan, run, resume, startOver, skipHistory, reset };
}
