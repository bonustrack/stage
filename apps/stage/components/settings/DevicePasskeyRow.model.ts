export type DevicePasskeyState = 'loading' | 'unknown' | 'unavailable' | 'add' | 'pending' | 'active';

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
  return input.installed ? 'active' : 'pending';
}

export interface DevicePasskeyRowCopy { label: string; description: string }

export const DEVICE_PASSKEY_LABEL = "This device's passkey";

const ROW_COPY: Record<'add' | 'pending', DevicePasskeyRowCopy> = {
  add: {
    label: 'Add a passkey for this device',
    description:
      'Creates a passkey in this device\'s password manager so it can approve transactions. The device that holds your account passkey approves it once.',
  },
  pending: {
    label: "Finish adding this device's passkey",
    description: 'Waiting for approval from the device that holds your account passkey.',
  },
};

export function devicePasskeyRowCopy(state: 'add' | 'pending'): DevicePasskeyRowCopy {
  return ROW_COPY[state];
}

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
    'This device will no longer approve transactions. Your account passkey on your other device keeps full control. The passkey stays in this device\'s password manager until you delete it there.',
  confirmLabel: 'Remove',
} as const;

export const DEVICE_SHEET_COPY = {
  title: 'Add a passkey for this device',
  request:
    'On the device that holds your account passkey, open Settings, Security, Approve a passkey from another device, then scan this code or paste it there.',
  approval: 'Then scan or paste the approval code it shows.',
  approvalLabel: 'Approval code',
  finish: 'Finish',
  finishing: 'Adding the passkey…',
  done: 'Passkey added. This device can now approve transactions.',
} as const;

export const APPROVE_SHEET_COPY = {
  title: 'Approve a passkey from another device',
  intro: 'Scan the code shown by Add a passkey for this device on your other device, or paste it here.',
  requestLabel: 'Request code',
  warning:
    'Only approve a code you just created on your own device. The approved passkey can send transactions from this account.',
  approve: 'Approve with passkey',
  approving: 'Waiting for the passkey…',
  result: 'Scan this approval code with the other device, or copy it there, then tap Finish on that device.',
} as const;

export function fingerprintLine(fingerprint: string): string {
  return `Check that both devices show ${fingerprint}.`;
}

export function approveRowVisible(custody: string | null): boolean {
  return custody === 'passkey-root';
}
