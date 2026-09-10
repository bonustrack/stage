import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Hex } from 'viem';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import { holdOnboarding } from '../../lib/onboardingHold';
import { ONBOARDING_HISTORY_WAIT_MS, runHistorySync, waitForHistorySyncSettled } from '../../lib/historySync';
import {
  createWallet, restoreWallet, importKeyAccount, bringMessagingOnline, XmtpSetupError,
  type SetupWarning, type Stage,
} from './flow';
import type { SetupErr } from './Onboarding.setup.model';

export type Choice =
  | { kind: 'create' }
  | { kind: 'restore'; phrase: string }
  | { kind: 'importKey'; pk: Hex };

export interface SetupRunner {
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  withHistory: boolean;
  run: (choice: Choice, withPasskey: boolean) => void;
  retryMessaging: (accountId: string) => void;
  skipHistory: () => void;
  reset: () => void;
}

function choiceSyncsHistory(choice: Choice): boolean {
  return choice.kind !== 'create';
}

async function runChoice(choice: Choice, withPasskey: boolean, onStage: (s: Stage) => void): Promise<SetupWarning> {
  if (choice.kind === 'create') return createWallet(withPasskey, onStage);
  if (choice.kind === 'restore') return restoreWallet(choice.phrase, withPasskey, onStage);
  return importKeyAccount(choice.pk, onStage);
}

function describe(e: unknown): string {
  return txErrorMessage(e, 'Something went wrong.');
}

export function useSetupRunner(onDone: () => void): SetupRunner {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<SetupErr | null>(null);
  const [withHistory, setWithHistory] = useState(false);
  const skipped = useRef(false);

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
    if (warning !== null) {
      Alert.alert('Passkey not added', `${warning} You can add a passkey later from Settings, Security.`);
    }
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

  const run = (choice: Choice, withPasskey: boolean): void => {
    if (busy) return;
    const syncHistory = choiceSyncsHistory(choice);
    setWithHistory(syncHistory);
    begin('wallet');
    void (async (): Promise<void> => {
      try {
        const warning = await runChoice(choice, withPasskey, setStage);
        await tail(syncHistory, warning);
      } catch (e) {
        setBusy(false);
        if (e instanceof XmtpSetupError) setSetupErr({ message: e.message, accountId: e.accountId });
        else setSetupErr({ message: describe(e) });
      }
    })();
  };

  const retryMessaging = (accountId: string): void => {
    if (busy) return;
    begin('messaging');
    void (async (): Promise<void> => {
      try {
        await bringMessagingOnline(accountId, setStage);
        await tail(withHistory, null);
      } catch (e) {
        setBusy(false);
        setSetupErr({ message: describe(e), accountId });
      }
    })();
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

  return { busy, stage, setupErr, withHistory, run, retryMessaging, skipHistory, reset };
}
