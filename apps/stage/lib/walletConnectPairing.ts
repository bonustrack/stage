import { makeValue } from './storeCore';

const pairingUri = makeValue<string | null>(null);
let cancelPairing: (() => void) | null = null;

export const useWalletConnectUri = pairingUri.use;

export function showPairingUri(uri: string | null): void {
  pairingUri.set(uri);
}

export function onPairingCancel(cancel: (() => void) | null): void {
  cancelPairing = cancel;
}

export function cancelWalletConnectPairing(): void {
  pairingUri.set(null);
  const cancel = cancelPairing;
  cancelPairing = null;
  cancel?.();
}
