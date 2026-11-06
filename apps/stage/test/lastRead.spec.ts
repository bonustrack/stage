import { beforeEach, expect, mock, test } from 'bun:test';

const secure = new Map<string, string>();
let readFails = false;
mock.module('../platform/storage', () => ({
  appStorage: { get: async () => null, set: async () => undefined },
  secureStorage: {
    get: async (key: string): Promise<string | null> => {
      if (readFails) throw new Error('keychain locked');
      return secure.get(key) ?? null;
    },
    set: async (key: string, value: string): Promise<void> => {
      secure.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      secure.delete(key);
    },
  },
}));
mock.module('../lib/cache', () => ({
  persistenceBackend: { read: async () => null, write: () => undefined, onFlushSignal: () => undefined },
}));
const { getLastReadNs, raiseLastReadNs } = await import('../lib/channelsCache');

beforeEach(() => {
  secure.clear();
  readFails = false;
});

test('a remote read position only ever raises the local one', async () => {
  await raiseLastReadNs('conv', 50);
  expect(await getLastReadNs('conv')).toBe(50);
  secure.set('unread.lastRead.conv', '100');
  await raiseLastReadNs('conv', 50);
  expect(await getLastReadNs('conv')).toBe(100);
});

test('an unreadable local position rejects instead of being overwritten by an older remote one', async () => {
  secure.set('unread.lastRead.conv', '100');
  readFails = true;
  await expect(raiseLastReadNs('conv', 50)).rejects.toThrow('keychain locked');
  readFails = false;
  expect(await getLastReadNs('conv')).toBe(100);
});
