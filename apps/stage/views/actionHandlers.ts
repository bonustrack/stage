import type { PayloadHandlers } from '@stage-labs/kit/kit';
import type { Capabilities } from './capabilities';
import { LINK_OPEN, SCREEN_BACK } from './actions';

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function backAction(caps: Capabilities): PayloadHandlers {
  return {
    [SCREEN_BACK]: (): void => {
      caps.back();
    },
  };
}

export function navigateAction(
  actionType: string,
  caps: Capabilities,
  resolve?: (payload: Record<string, unknown>) => string | undefined,
): PayloadHandlers {
  return {
    [actionType]: (payload): void => {
      const to = resolve
        ? resolve(payload)
        : payloadString(payload, 'href') ?? payloadString(payload, 'to');
      if (to) caps.navigate(to);
    },
  };
}

export function openUrlAction(
  caps: Capabilities,
  actionType: string = LINK_OPEN,
  urlKey = 'url',
): PayloadHandlers {
  return {
    [actionType]: (payload): void => {
      const url = payloadString(payload, urlKey);
      if (url) caps.openUrl(url);
    },
  };
}

export function copyAction(
  actionType: string,
  caps: Capabilities,
  getText: () => string | null | undefined,
  toastMessage?: string,
): PayloadHandlers {
  return {
    [actionType]: (): void => {
      const text = getText();
      if (!text) return;
      void caps.copyToClipboard(text);
      if (toastMessage) caps.toast(toastMessage);
    },
  };
}
