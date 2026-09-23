export type RestoreOffer = 'add-passkey' | 'make-root-here' | 'make-root-elsewhere';

export type RestoreCustody = 'undeployed' | 'ecdsa-root' | 'passkey-root' | 'other-root';

export type RestoreMigration = 'not-needed' | 'passkey' | 'device-passkey' | 'recovery-key' | 'elsewhere';

export interface RestoreOfferInput {
  custody: RestoreCustody | null;
  migration: RestoreMigration | null;
  passkeysAvailable: boolean;
  devicePasskeyStored: boolean;
}

export function restoreOffer(input: RestoreOfferInput): RestoreOffer | null {
  if (input.custody === 'passkey-root') {
    if (input.migration === null || input.migration === 'not-needed') return null;
    return input.migration === 'elsewhere' ? 'make-root-elsewhere' : 'make-root-here';
  }
  if (input.custody !== 'ecdsa-root' && input.custody !== 'undeployed') return null;
  return input.passkeysAvailable && !input.devicePasskeyStored ? 'add-passkey' : null;
}

export interface RestoreOfferCopy { title: string; message: string; confirmLabel: string }

export const RESTORE_OFFER_COPY: Record<RestoreOffer, RestoreOfferCopy> = {
  'add-passkey': {
    title: 'Add a passkey for this device?',
    message:
      'Approve transactions here with Face ID, fingerprint or your screen lock. Your recovery phrase stays the main key. You can also do this later in Settings, Security.',
    confirmLabel: 'Add passkey',
  },
  'make-root-here': {
    title: 'Make your recovery phrase the main key?',
    message:
      'This wallet is still secured by a passkey from an older version of Stage. Messaging already works. Make your recovery phrase the main key so every device with the phrase can also use the wallet, then add a passkey per device if you like.',
    confirmLabel: 'Make it the main key',
  },
  'make-root-elsewhere': {
    title: 'Finish on your passkey device',
    message:
      'Messaging works on this device. This wallet is still secured by a passkey from an older version of Stage, so this device cannot send transactions yet. On the device that has the passkey, open Settings, Security and tap Make your recovery phrase the main key. After that, every device with your recovery phrase can use the wallet.',
    confirmLabel: 'OK',
  },
};
