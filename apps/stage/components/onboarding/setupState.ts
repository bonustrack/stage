import { Alert } from 'react-native';
import { makeValue } from '../../lib/storeCore';
import { returnedPrivyMethod } from '../../lib/privyBridge';
import type { SetupWarning, Stage } from './flow';
import type { SetupErr, SetupPlan } from './Onboarding.setup.model';

export const setupRunning = makeValue(false);
export const setupBusy = makeValue(false);
export const setupStage = makeValue<Stage>('wallet');
export const setupError = makeValue<SetupErr | null>(null);
export const setupPlan = makeValue<SetupPlan>(startPlan());
export const historyStalled = makeValue(false);

let heldWarning: SetupWarning = null;
const doneHandlers: (() => void)[] = [];
const cancelHandlers: (() => void)[] = [];

export function holdWarning(warning: SetupWarning): void {
  heldWarning = warning;
}

export function heldSetupWarning(): SetupWarning {
  return heldWarning;
}

function startPlan(): SetupPlan {
  const method = returnedPrivyMethod();
  return method === null ? {} : { signIn: method };
}

export function resetSetupState(): void {
  setupBusy.set(false);
  setupStage.set('wallet');
  setupError.set(null);
  setupPlan.set(startPlan());
  historyStalled.set(false);
  heldWarning = null;
}

export function onSetupDone(handler: () => void): () => void {
  return latest(doneHandlers, handler);
}

function latest(handlers: (() => void)[], handler: () => void): () => void {
  handlers.push(handler);
  return () => {
    const at = handlers.lastIndexOf(handler);
    if (at !== -1) handlers.splice(at, 1);
  };
}

export function onSetupCancel(handler: () => void): () => void {
  return latest(cancelHandlers, handler);
}

export function setupCancelled(): void {
  cancelHandlers.at(-1)?.();
}

export function setupDone(warning: SetupWarning): void {
  const done = doneHandlers.at(-1);
  if (done === undefined) return;
  done();
  if (warning !== null) Alert.alert(warning.title, warning.message);
}
