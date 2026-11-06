import { describe, expect, mock, test } from 'bun:test';
import { SYNC_KIND_NAMES } from '@stage-labs/client/xmtp/sync/registry';

mock.module('../platform/storage', () => ({
  secureStorage: { get: async () => null, set: async () => undefined, delete: async () => undefined },
  appStorage: { get: async () => null, set: async () => undefined, delete: async () => undefined },
}));
mock.module('../lib/cache', () => ({
  persistenceBackend: { read: async () => null, write: () => undefined, onFlushSignal: () => undefined },
}));
mock.module('../lib/xmtp.sdk', () => ({ convOfLine: async () => null, sdk: {} }));
mock.module('../lib/xmtp.client', () => ({ cachedSelfEthAddress: () => null }));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => null,
  getActiveAccountStrict: async () => null,
  getSelectedAccount: async () => null,
}));
mock.module('../lib/liveSnapshots', () => ({ forgetLiveSnapshots: () => undefined }));
const { SYNC_APP_KINDS } = await import('../lib/sync/kinds');
const { SHARED_CURSOR } = await import('../lib/sync/replay');

describe('synced kinds', () => {
  test('every wire kind is declared once by the app, in registry order', () => {
    expect(SYNC_APP_KINDS.map((kind) => kind.kind)).toEqual([...SYNC_KIND_NAMES]);
  });

  test('Developer mode replays on its own strict cursor and never through the shared one', () => {
    const shared = SYNC_APP_KINDS.filter((kind) => kind.cursor === SHARED_CURSOR).map((kind) => kind.kind);
    expect(shared).not.toContain('developerMode');
    const own = SYNC_APP_KINDS.filter((kind) => kind.cursor !== SHARED_CURSOR);
    expect(own.map((kind) => [kind.kind, kind.cursor.prefix, kind.cursor.strict])).toEqual([
      ['developerMode', 'developerMode.cursor.v1.', true],
    ]);
    expect(SHARED_CURSOR).toEqual({ prefix: 'readSync.cursor.v4.', strict: false });
  });
});
