import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { Linking, type AlertButton } from 'react-native';
import { reported } from './errorPolicy';
import { internalLinkPath } from '@stage-labs/client/routing/deepLinks';
import { isAllowedLinkScheme } from '@stage-labs/client/routing/stageLinks';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export interface Capabilities {
  navigate(to: string): void;
  back(): void;
  backTo(to: Href): void;
  copyToClipboard(text: string): void | Promise<void>;
  copy(label: string, value: string): void;
  toast(message: string): void;
  alert(title: string, message?: string, buttons?: AlertButton[]): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  openUrl(url: string): void;
  reload(home?: boolean): void;
}

export interface PlatformEffects {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  toast: (message: string) => void;
  reload: (home: boolean) => void;
}

function openLink(url: string): void {
  const internal = internalLinkPath(url);
  if (internal) router.push(internal);
  else if (isAllowedLinkScheme(url)) void Linking.openURL(url).catch(reported('link.open'));
}

export function openInBubbleLink(url: string): boolean {
  openLink(url);
  return false;
}

function confirmWith(alert: PlatformEffects['alert'], options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    alert(options.title, options.message, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          resolve(false);
        },
      },
      {
        text: options.confirmLabel ?? 'OK',
        style: options.destructive ? 'destructive' : undefined,
        onPress: () => {
          resolve(true);
        },
      },
    ]);
  });
}

export function makeCapabilities(platform: PlatformEffects): Capabilities {
  return {
    navigate: (to) => {
      router.push(to);
    },
    back: () => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    },
    backTo: (to) => {
      router.dismissTo(to);
    },
    copyToClipboard: async (text) => {
      await Clipboard.setStringAsync(text);
    },
    copy: (label, value) => {
      void Clipboard.setStringAsync(value);
      platform.toast(`${label} copied`);
    },
    toast: platform.toast,
    alert: platform.alert,
    confirm: (options) => confirmWith(platform.alert, options),
    openUrl: openLink,
    reload: (home = false) => {
      platform.reload(home);
    },
  };
}
