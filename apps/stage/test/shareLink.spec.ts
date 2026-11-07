import { beforeEach, describe, expect, mock, test } from 'bun:test';

const copied: string[] = [];
mock.module('expo-clipboard', () => ({
  setStringAsync: (value: string) => {
    copied.push(value);
    return Promise.resolve(true);
  },
}));
mock.module('expo-router', () => ({ router: {} }));
mock.module('react-native', () => ({ Linking: {} }));
const { makeCapabilities } = await import('../lib/capabilities.core');

const URL = 'https://stage.box/channel/abc?m=m1';

function capabilitiesSharing(share: (text: string) => Promise<boolean>): { toasts: string[]; shareLink: (url: string) => void } {
  const toasts: string[] = [];
  const caps = makeCapabilities({
    alert: () => undefined,
    share,
    toast: (message) => {
      toasts.push(message);
    },
    reload: () => undefined,
  });
  return { toasts, shareLink: caps.shareLink };
}

function settled(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function failing(name: string): () => Promise<boolean> {
  return () => {
    const err = new Error('share failed');
    err.name = name;
    return Promise.reject(err);
  };
}

describe('sharing a link', () => {
  beforeEach(() => {
    copied.length = 0;
  });

  test('the share sheet gets the link and nothing is copied', async () => {
    const shared: string[] = [];
    const { toasts, shareLink } = capabilitiesSharing((text) => {
      shared.push(text);
      return Promise.resolve(true);
    });
    shareLink(URL);
    await settled();
    expect([shared, copied, toasts]).toEqual([[URL], [], []]);
  });

  test('without a share sheet the link is copied, with the copy toast', async () => {
    const { toasts, shareLink } = capabilitiesSharing(() => Promise.resolve(false));
    shareLink(URL);
    await settled();
    expect([copied, toasts]).toEqual([[URL], ['Link copied']]);
  });

  test('closing the share sheet copies nothing', async () => {
    const { toasts, shareLink } = capabilitiesSharing(failing('AbortError'));
    shareLink(URL);
    await settled();
    expect([copied, toasts]).toEqual([[], []]);
  });

  test('a share sheet that fails falls back to copying the link', async () => {
    const { toasts, shareLink } = capabilitiesSharing(failing('NotAllowedError'));
    shareLink(URL);
    await settled();
    expect([copied, toasts]).toEqual([[URL], ['Link copied']]);
  });
});
