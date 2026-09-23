import type { PasskeyMode } from './flow';

export interface PasskeyStepCopy { title: string; body: string; action: string; skip: string | null }

const ADD_PASSKEY: PasskeyStepCopy = {
  title: 'Add a passkey',
  body: 'Approve transactions on this device with a passkey instead of your recovery phrase.',
  action: 'Add a passkey',
  skip: null,
};

const CONTINUE_WITHOUT = 'Continue without passkey';

const VERIFY_PASSKEY: PasskeyStepCopy = {
  title: 'Confirm your passkey',
  body: 'This wallet is protected by a passkey. If this device has it, confirm it to approve transactions here. Otherwise continue without it: messaging works right away, and you can add a passkey for this device later in Settings, Security.',
  action: 'Confirm passkey',
  skip: CONTINUE_WITHOUT,
};

const VERIFY_LATER = 'You can continue without it and add a passkey for this device later in Settings, Security.';

export function passkeyStepCopy(mode: PasskeyMode, error: string | null = null): PasskeyStepCopy {
  const base = mode === 'verify' ? VERIFY_PASSKEY : ADD_PASSKEY;
  if (error === null) return base;
  const body = mode === 'verify' ? `${error} ${VERIFY_LATER}` : error;
  return { ...base, title: 'Passkey not confirmed', body, action: 'Try again' };
}

export function passkeyStepSkippable(mode: PasskeyMode, error: string | null): boolean {
  return mode === 'verify' || error === null;
}
