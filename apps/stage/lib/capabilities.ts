
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Alert, Linking, Share } from 'react-native';
import { flash } from './toast';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export interface Capabilities {
  navigate(to: string): void;
  back(): void;
  copyToClipboard(text: string): void | Promise<void>;
  toast(message: string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  openUrl(url: string): void;
  share(payload: { text?: string; url?: string }): void | Promise<void>;
}

function confirmWithAlert(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => { resolve(false); } },
      {
        text: options.confirmLabel ?? 'OK',
        style: options.destructive ? 'destructive' : undefined,
        onPress: () => { resolve(true); },
      },
    ]);
  });
}

export const capabilities: Capabilities = {
  navigate: (to) => { router.push(to); },
  back: () => { router.back(); },
  copyToClipboard: async (text) => { await Clipboard.setStringAsync(text); },
  toast: flash,
  confirm: confirmWithAlert,
  openUrl: (url) => { void Linking.openURL(url); },
  share: async (payload) => {
    await Share.share({ message: payload.text ?? payload.url ?? '' });
  },
};
