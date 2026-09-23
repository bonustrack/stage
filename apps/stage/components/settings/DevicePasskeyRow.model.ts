export type DevicePasskeyState = 'loading' | 'unknown' | 'unavailable' | 'add' | 'active';

export interface DevicePasskeyStateInput {
  available: boolean;
  stored: boolean;
  installed: boolean | null | undefined;
}

export function devicePasskeyState(input: DevicePasskeyStateInput): DevicePasskeyState {
  if (!input.available) return 'unavailable';
  if (!input.stored) return 'add';
  if (input.installed === undefined) return 'loading';
  if (input.installed === null) return 'unknown';
  return input.installed ? 'active' : 'add';
}

export const DEVICE_PASSKEY_LABEL = "This device's passkey";

export const ENABLE_PASSKEY_ROW = {
  label: 'Enable passkey',
  busy: 'Waiting for the passkey…',
  description:
    'Approve transactions on this device with Face ID, fingerprint or your screen lock. Your recovery phrase stays the main key and works on every device.',
} as const;

export const ENABLE_PASSKEY_CONFIRM = {
  title: 'Enable passkey',
  message:
    'Create a passkey on this device and use it to approve transactions here. Your recovery phrase stays the main key, so you can still restore the wallet anywhere.',
  confirmLabel: 'Enable',
} as const;

export const DEVICE_PASSKEY_DONE = 'Passkey enabled. This device now approves transactions with it.';

const STATE_VALUES: Record<'loading' | 'unknown' | 'unavailable' | 'active', string> = {
  loading: 'Checking…',
  unknown: 'Could not check. Try again later.',
  unavailable: 'Passkeys are not available on this device',
  active: 'Approves transactions on this device',
};

export function devicePasskeyValue(state: 'loading' | 'unknown' | 'unavailable' | 'active'): string {
  return STATE_VALUES[state];
}

export const REMOVE_DEVICE_PASSKEY = {
  label: "Remove this device's passkey",
  title: "Remove this device's passkey?",
  message:
    'This device stops approving transactions with this passkey. The passkey stays in this device\'s password manager until you delete it there.',
  confirmLabel: 'Remove',
} as const;
