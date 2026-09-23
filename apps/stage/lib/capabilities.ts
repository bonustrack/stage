import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Alert, Linking, Platform, Share, ToastAndroid } from 'react-native';
import { showToast } from './toastHost';
import { reported } from './errorPolicy';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

function confirmDialog(options: ConfirmOptions): Promise<boolean> {
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
  else showToast(message);
}

export const capabilities: Capabilities = {
  navigate: (to) => { router.push(to); },
  back: () => { router.back(); },
  backTo: (to) => { router.dismissTo(to); },
  copyToClipboard: async (text) => { await Clipboard.setStringAsync(text); },
  copy: (label, value) => { void Clipboard.setStringAsync(value); toast(`${label} copied`); },
  toast,
  confirm: confirmDialog,
  openUrl: (url) => { void Linking.openURL(url).catch(reported('link.open')); },
  share: async (payload) => {
    await Share.share({ message: payload.text ?? payload.url ?? '' });
  },
};
