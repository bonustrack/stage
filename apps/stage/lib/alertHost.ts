import type { AlertButton } from 'react-native';
import { makeValue } from './storeCore';

export interface AlertRequest {
  title: string;
  message: string | undefined;
  buttons: AlertButton[];
}

const alert = makeValue<AlertRequest | null>(null);

export function presentAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  alert.set({ title, message, buttons: buttons !== undefined && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
}

export function dismissAlert(): void {
  alert.set(null);
}

export const useAlertRequest = alert.use;
