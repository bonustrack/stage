import {
  NO_SYNC_STAMPS, mergeSyncStamps, parseSyncStamps, type PinStamp, type SyncStamps,
} from '@stage-labs/client/xmtp/syncSnapshot';

export interface SyncStampsDeps {
  get: (key: string) => Promise<string | null>;
  save: (key: string, raw: string) => void;
}

export interface SyncStampsStore {
  read: (accountId: string) => Promise<SyncStamps | null>;
  adopt: (accountId: string, stored: SyncStamps | null, persist: boolean) => void;
  clear: () => void;
  current: () => SyncStamps;
  loaded: () => boolean;
  persisting: () => boolean;
  stampPin: (pin: PinStamp) => void;
  stampBoard: (at: number) => void;
  seed: (from: SyncStamps) => void;
}

const STAMPS_PREFIX = 'readSync.stamps.';

export function makeSyncStampsStore(deps: SyncStampsDeps): SyncStampsStore {
  let stamps: SyncStamps = NO_SYNC_STAMPS;
  let key: string | null = null;
  let loaded = false;

  function update(next: SyncStamps): void {
    stamps = next;
    if (key !== null) deps.save(key, JSON.stringify(stamps));
  }

  return {
    read: async (accountId) => parseSyncStamps(await deps.get(STAMPS_PREFIX + accountId)),
    adopt: (accountId, stored, persist) => {
      loaded = true;
      key = persist ? STAMPS_PREFIX + accountId : null;
      update(stored === null ? stamps : mergeSyncStamps(stored, stamps));
    },
    clear: () => {
      stamps = NO_SYNC_STAMPS;
      key = null;
      loaded = false;
    },
    current: () => stamps,
    loaded: () => loaded,
    persisting: () => key !== null,
    stampPin: (pin) => { update({ ...stamps, pin }); },
    stampBoard: (at) => { update({ ...stamps, boardAt: at }); },
    seed: (from) => { update(mergeSyncStamps(stamps, from)); },
  };
}
