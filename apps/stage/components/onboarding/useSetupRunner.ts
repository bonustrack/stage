import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Hex } from 'viem';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import { holdOnboarding } from '../../lib/accountGate';
import { receiveHistoryWithCode, syncHistoryToEnd } from '../../lib/history';
import {
  createWallet, restoreWallet, importKeyAccount, bringMessagingOnline, abandonAccount, XmtpSetupError,
  type SetupWarning, type Stage,
} from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';
import type { ProfileSetup } from './Onboarding.profile.model';
import { reported } from '../../lib/errorPolicy';

export type Choice =
  | { kind: 'create'; profile?: ProfileSetup }
  | { kind: 'restore'; phrase: string }
  | { kind: 'importKey'; pk: Hex };

export interface SetupRunner {
  busy: boolean;
  stage: Stage;
  setupErr: SetupErr | null;
  plan: SetupPlan;
  run: (choice: Choice) => void;
  resume: (accountId: string) => void;
  startOver: () => void;
  history: HistoryControls;
  reset: () => void;
}

export interface HistoryControls {
  stalled: boolean;
  retry: () => void;
  receiveCode: (code: string) => Promise<void>;
  continueWithout: () => void;
}

function errorFrom(e: unknown): SetupErr {
  if (e instanceof XmtpSetupError) return { message: e.message, accountId: e.accountId, retry: 'messaging' };
  return { message: describe(e), retry: 'restart' };
}

async function runChoice(choice: Choice, onStage: (s: Stage) => void): Promise<SetupWarning> {
  if (choice.kind === 'create') return createWallet(onStage, choice.profile);
  if (choice.kind === 'restore') return restoreWallet(choice.phrase, onStage);
  return importKeyAccount(choice.pk, onStage);
}

function describe(e: unknown): string {
  return txErrorMessage(e, 'Something went wrong.');
}

function useLatch(): [boolean, (next: boolean) => void, () => boolean] {
  const [value, setValueState] = useState(false);
  const latched = useRef(false);
  const setValue = (next: boolean): void => {
    latched.current = next;
    setValueState(next);
  };
  return [value, setValue, () => latched.current];
}

export function useSetupRunner(onDone: () => void): SetupRunner {
  const [busy, setBusy, isBusy] = useLatch();
  const [stage, setStage] = useState<Stage>('wallet');
  const [setupErr, setSetupErr] = useState<SetupErr | null>(null);
  const [plan, setPlan] = useState<SetupPlan>({});
  const [historyStalled, setHistoryStalled, isStalled] = useLatch();
  const heldWarning = useRef<SetupWarning>(null);

  const begin = (first: Stage): void => {
    holdOnboarding(true);
    setBusy(true);
    setSetupErr(null);
    setStage(first);
  };

  const finish = (warning: SetupWarning): void => {
    holdOnboarding(false);
    setBusy(false);
    onDone();
    if (warning !== null) Alert.alert(warning.title, warning.message);
  };

  const tail = async (syncHistory: boolean, warning: SetupWarning): Promise<void> => {
    if (syncHistory) {
      setStage('history');
      setHistoryStalled(false);
      if ((await syncHistoryToEnd()) !== 'done') {
        heldWarning.current = warning;
        setHistoryStalled(true);
        return;
      }
    }
    setStage('finishing');
    finish(warning);
  };

  const run = (choice: Choice): void => {
    if (isBusy()) return;
    const restore = choice.kind !== 'create';
    setPlan({
      restore,
      profile: choice.kind === 'create' && choice.profile !== undefined,
      history: restore,
    });
    begin('wallet');
    void (async (): Promise<void> => {
      try {
        const warning = await runChoice(choice, setStage);
        await tail(restore, warning);
      } catch (e) {
        setBusy(false);
        setSetupErr(errorFrom(e));
      }
    })();
  };

  const resume = (accountId: string): void => {
    if (isBusy()) return;
    begin('messaging');
    void (async (): Promise<void> => {
      try {
        await bringMessagingOnline(accountId, setStage);
        await tail(plan.history === true, null);
      } catch (e) {
        setBusy(false);
        setSetupErr(errorFrom(e));
      }
    })();
  };

  const startOver = (): void => {
    const accountId = setupErr?.accountId;
    if (accountId !== undefined) void abandonAccount(accountId).catch(reported('onboarding.abandon'));
    reset();
  };

  const continueWithout = (): void => {
    if (!isStalled()) return;
    setHistoryStalled(false);
    setStage('finishing');
    finish(heldWarning.current);
  };

  const history: HistoryControls = {
    stalled: historyStalled,
    retry: () => { if (isStalled()) void tail(true, heldWarning.current); },
    receiveCode: async (code) => { await receiveHistoryWithCode(code); continueWithout(); },
    continueWithout,
  };

  const reset = (): void => {
    setSetupErr(null);
    holdOnboarding(false);
  };

  return { busy, stage, setupErr, plan, run, resume, startOver, history, reset };
}
