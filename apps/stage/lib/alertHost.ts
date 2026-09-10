import type { AlertButton } from 'react-native';
import { makeListeners, useStoreValue } from './storeCore';

export interface AlertRequest {
  title: string;
  message: string | undefined;
  buttons: AlertButton[];
}

let current: AlertRequest | null = null;
const { listeners, notify } = makeListeners();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function get(): AlertRequest | null { return current; }

export function presentAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  current = {
    title,
    message,
    buttons: buttons !== undefined && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  };
  notify();
}

export function dismissAlert(): void {
  current = null;
  notify();
}

export function useAlertRequest(): AlertRequest | null {
  return useStoreValue(subscribe, get);
}
