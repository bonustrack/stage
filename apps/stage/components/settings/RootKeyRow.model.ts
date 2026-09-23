export type RootKeyMigrationState = 'loading' | 'unknown' | 'not-needed' | 'passkey' | 'device-passkey' | 'recovery-key' | 'elsewhere';

export const ROOT_KEY_LABEL = 'Make your recovery phrase the main key';

const DESCRIPTIONS: Record<Exclude<RootKeyMigrationState, 'not-needed'>, string> = {
  loading: 'Checking who can approve this change…',
  unknown: 'Could not check the wallet on-chain. Try again later.',
  passkey:
    'This wallet is still secured by a passkey from an older version of Stage. Approve once with that passkey and your recovery phrase becomes the main key, so every device with the phrase can use the wallet.',
  'device-passkey':
    'This wallet is still secured by a passkey from an older version of Stage. Approve once with this device\'s passkey and your recovery phrase becomes the main key.',
  'recovery-key':
    'This wallet is still secured by a passkey from an older version of Stage. Your recovery key is allowed to transact, so this device can make the recovery phrase the main key by itself.',
  elsewhere:
    'This wallet is still secured by a passkey from an older version of Stage. Do this once on the device that has that passkey, or link the passkey here first.',
};

export function rootKeyDescription(state: Exclude<RootKeyMigrationState, 'not-needed'>): string {
  return DESCRIPTIONS[state];
}

export function rootKeyActionable(state: RootKeyMigrationState): boolean {
  return state === 'passkey' || state === 'device-passkey' || state === 'recovery-key';
}

export const ROOT_KEY_CONFIRM = {
  title: 'Make your recovery phrase the main key?',
  message:
    'Your recovery phrase becomes the key that controls this wallet, and the old passkey stops controlling it. Anyone with the phrase controls the wallet, so keep it safe. You can then add a passkey on each device to approve transactions.',
  confirmLabel: 'Make it the main key',
} as const;

export const ROOT_KEY_DONE = 'Your recovery phrase is now the main key.';

export const KEEP_PASSKEY_CONFIRM = {
  title: 'Keep using your passkey here?',
  message: 'Add the same passkey back as this device\'s passkey, so transactions on this device still ask for Face ID, fingerprint or your screen lock.',
  confirmLabel: 'Keep passkey',
} as const;
