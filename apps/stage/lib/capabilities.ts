import { Alert, DevSettings, Platform, Share, ToastAndroid } from 'react-native';
import { reloadAsync } from 'expo-updates';
import { makeCapabilities } from './capabilities.core';
import { showToast } from './toastHost';
import { reported } from './errorPolicy';

export type { ConfirmOptions } from './capabilities.core';
export { openInBubbleLink } from './capabilities.core';

export const capabilities = makeCapabilities({
  alert: (title, message, buttons) => {
    Alert.alert(title, message, buttons);
  },
  share: async (text) => {
    await Share.share({ message: text });
    return true;
  },
  toast: (message) => {
    if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
    else showToast(message);
  },
  reload: () => {
    if (DevSettings.reload) {
      DevSettings.reload();
      return;
    }
    void reloadAsync().catch(reported('app.reload'));
  },
});
