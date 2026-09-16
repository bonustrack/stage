import type { PasskeyMode } from './flow';

export interface PasskeyStepCopy { title: string; body: string; action: string; skippable: boolean }

const ADD_PASSKEY: PasskeyStepCopy = {
  title: 'Add a passkey',
  body: 'Approve transactions on this device with a passkey instead of your recovery phrase.',
  action: 'Add a passkey',
  skippable: true,
};

const VERIFY_PASSKEY: PasskeyStepCopy = {
  title: 'Confirm your passkey',
  body: 'This wallet is protected by a passkey. Confirm it on this device to keep using it here.',
  action: 'Confirm passkey',
  skippable: false,
};

export function passkeyStepCopy(mode: PasskeyMode, error: string | null = null): PasskeyStepCopy {
  const base = mode === 'verify' ? VERIFY_PASSKEY : ADD_PASSKEY;
  if (error === null) return base;
  return { ...base, title: 'Passkey not confirmed', body: error, action: 'Try again' };
}
