
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Alert, Linking, Share } from 'react-native';
import type { Capabilities, ConfirmOptions } from '@stage-labs/views';
import { flash } from './toast';

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
