
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Linking, Platform, Share, ToastAndroid } from 'react-native';
import { confirmDialog, type ConfirmOptions } from './confirm';

export interface Capabilities {
  navigate(to: string): void;
  back(): void;
  backTo(to: string): void;
  copyToClipboard(text: string): void | Promise<void>;
  copy(label: string, value: string): void;
  toast(message: string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  openUrl(url: string): void;
  share(payload: { text?: string; url?: string }): void | Promise<void>;
}

function toast(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
}

export const capabilities: Capabilities = {
  navigate: (to) => { router.push(to); },
  back: () => { router.back(); },
  backTo: (to) => { router.dismissTo(to); },
  copyToClipboard: async (text) => { await Clipboard.setStringAsync(text); },
  copy: (label, value) => { void Clipboard.setStringAsync(value); toast(`${label} copied`); },
  toast,
  confirm: confirmDialog,
  openUrl: (url) => { void Linking.openURL(url); },
  share: async (payload) => {
    await Share.share({ message: payload.text ?? payload.url ?? '' });
  },
};
