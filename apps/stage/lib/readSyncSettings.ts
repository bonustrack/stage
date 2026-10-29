import {
  shouldApplyReadState,
  type BoardStateContent,
  type LatestKind,
  type SyncContents,
  type SyncReplay,
} from '@stage-labs/client/xmtp/readState';
import { SYNC_CODECS, type JsonCodec } from '@stage-labs/client/xmtp/jsonCodecs';
import { sendSyncState, type SyncTarget } from './syncTarget';
import { applyRemoteBoardOrder, loadBoardOrder, onBoardOrderChanged, type AccountOrderChange } from './boardOrder';
import { applyRemoteCategoryOrder, loadCategoryOrder, onCategoryOrderChanged } from './channelGroups';
import { applyRemoteSearchState, loadSearchState, onSearchStateChanged } from './searchState';
import { applyRemoteHomeView, loadHomeView, onHomeViewChanged } from './homeView';
import { applyRemoteDashboard, loadDashboard, onDashboardChanged } from './dashboard';
import { applyRemoteDeveloperMode, loadDeveloperMode, onDeveloperModeChanged } from './developerMode';

const SEARCH_DEBOUNCE_MS = 1000;

interface LatestWins {
  start: () => void;
  apply: (accountId: string, replay: SyncReplay) => Promise<void>;
  publishTo: (target: SyncTarget, accountId: string) => Promise<void>;
}

interface SettingsSync {
  localAt: Map<string, number>;
  publish: <T>(codec: JsonCodec<T>, content: T, onlyFor?: string) => void;
  debounce: (key: string, fn: () => void, delayMs?: number) => void;
  publishDeveloperMode: (accountId: string) => void;
}

function stampOrderState(sync: SettingsSync, key: string, order: readonly string[]): BoardStateContent {
  const at = Date.now();
  sync.localAt.set(key, at);
  return { order: [...order], at };
}

function latestWins<K extends LatestKind>(
  sync: SettingsSync,
  kind: K,
  setting: {
    onLocal: (send: (accountId: string, state: SyncContents[K]) => void) => void;
    apply: (accountId: string, state: SyncContents[K]) => Promise<void>;
    load: (accountId: string) => Promise<SyncContents[K] | null>;
    delayMs?: number;
  },
): LatestWins {
  const codec = SYNC_CODECS[kind];
  return {
    start: () => {
      setting.onLocal((accountId, state) => {
        sync.debounce(
          kind,
          () => {
            sync.publish(codec, state, accountId);
          },
          setting.delayMs,
        );
      });
    },
    apply: async (accountId, replay) => {
      const state = replay.latest[kind];
      if (state !== null) await setting.apply(accountId, state);
    },
    publishTo: async (target, accountId) => {
      const state = await setting.load(accountId);
      if (state !== null) await sendSyncState(target, codec, state);
    },
  };
}

function orderWins(
  sync: SettingsSync,
  kind: 'board' | 'categoryOrder',
  setting: {
    onChanged: (cb: (change: AccountOrderChange) => void) => void;
    apply: (accountId: string, order: readonly string[]) => Promise<void>;
    load: (accountId: string) => Promise<readonly string[]>;
  },
): LatestWins {
  return latestWins(sync, kind, {
    onLocal: (send) => {
      setting.onChanged((change) => {
        send(change.accountId, stampOrderState(sync, kind, change.order));
      });
    },
    apply: async (accountId, state) => {
      if (!shouldApplyReadState(sync.localAt.get(kind), state.at)) return;
      sync.localAt.set(kind, state.at);
      await setting.apply(accountId, state.order);
    },
    load: async (accountId) => {
      const order = await setting.load(accountId);
      return order.length === 0 ? null : stampOrderState(sync, kind, order);
    },
  });
}

export function latestWinsSettings(sync: SettingsSync): readonly LatestWins[] {
  return [
    orderWins(sync, 'board', { onChanged: onBoardOrderChanged, apply: applyRemoteBoardOrder, load: loadBoardOrder }),
    orderWins(sync, 'categoryOrder', { onChanged: onCategoryOrderChanged, apply: applyRemoteCategoryOrder, load: loadCategoryOrder }),
    latestWins(sync, 'search', {
      onLocal: (send) => {
        onSearchStateChanged((change) => {
          send(change.accountId, change.state);
        });
      },
      apply: applyRemoteSearchState,
      load: loadSearchState,
      delayMs: SEARCH_DEBOUNCE_MS,
    }),
    latestWins(sync, 'homeView', {
      onLocal: (send) => {
        onHomeViewChanged((change) => {
          send(change.accountId, change.state);
        });
      },
      apply: applyRemoteHomeView,
      load: loadHomeView,
    }),
    latestWins(sync, 'dashboard', {
      onLocal: (send) => {
        onDashboardChanged((change) => {
          send(change.accountId, change.state);
        });
      },
      apply: applyRemoteDashboard,
      load: loadDashboard,
    }),
    latestWins(sync, 'developerMode', {
      onLocal: () => {
        onDeveloperModeChanged((change) => {
          sync.publishDeveloperMode(change.accountId);
        });
      },
      apply: applyRemoteDeveloperMode,
      load: loadDeveloperMode,
    }),
  ];
}
