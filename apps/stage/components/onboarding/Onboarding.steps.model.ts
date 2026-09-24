export interface PasskeyStepCopy { title: string; body: string; action: string }

export const PASSKEY_STEP_COPY: PasskeyStepCopy = {
  title: 'Add a passkey',
  body: 'Approve transactions on this device with Face ID, fingerprint or your screen lock. Your recovery phrase stays the main key, so you can always restore your wallet.',
  action: 'Add a passkey',
};
