import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { settle } from './helpers';

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
    await settle();
    expect([shared, copied, toasts]).toEqual([[URL], [], []]);
  });

  test.each<[string, () => Promise<boolean>, string[][]]>([
    ['without a share sheet the link is copied, with the copy toast', () => Promise.resolve(false), [[URL], ['Link copied']]],
    ['closing the share sheet copies nothing', failing('AbortError'), [[], []]],
    ['a share sheet that fails falls back to copying the link', failing('NotAllowedError'), [[URL], ['Link copied']]],
  ])('%s', async (_name, share, expected) => {
    const { toasts, shareLink } = capabilitiesSharing(share);
    shareLink(URL);
    await settle();
    expect([copied, toasts]).toEqual(expected);
  });
});
