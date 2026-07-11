
import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
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
