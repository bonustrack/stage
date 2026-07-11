
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Linking, Share } from 'react-native';
import { confirmDialog, type ConfirmOptions } from './confirm';
import { flash } from './toast';

export interface Capabilities {
  navigate(to: string): void;
  back(): void;
  copyToClipboard(text: string): void | Promise<void>;
  toast(message: string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  openUrl(url: string): void;
  share(payload: { text?: string; url?: string }): void | Promise<void>;
}

export const capabilities: Capabilities = {
  navigate: (to) => { router.push(to); },
  back: () => { router.back(); },
  copyToClipboard: async (text) => { await Clipboard.setStringAsync(text); },
  toast: flash,
  confirm: confirmDialog,
  openUrl: (url) => { void Linking.openURL(url); },
  share: async (payload) => {
    await Share.share({ message: payload.text ?? payload.url ?? '' });
  },
};
