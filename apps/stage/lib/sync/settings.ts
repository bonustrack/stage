import type { OrderStateContent } from '@stage-labs/client/xmtp/sync/order';
import type { SyncContents, SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
import { boardOrderSync } from '../boardOrder';
import { categoryOrderSync } from '../channelGroups';
import { searchStateSync } from '../searchState';
import { homeViewSync } from '../homeView';
import { dashboardSync } from '../dashboard';
import { developerModeSync } from '../developerMode';
import { stampLocal, takeIfNewer } from './clock';
import { defineAppSyncKind, type AppSyncKind, type KindJob } from './kind';
import type { SyncCursor } from './replay';
import type { SyncedSetting } from './setting';

type OrderKind = 'board' | 'categoryOrder';
type LatestKind = 'search' | 'homeView' | 'dashboard' | 'developerMode';
type LatestReplay = { [L in LatestKind]: SyncContents[L] | null };

const SEARCH_DEBOUNCE_MS = 1000;

const DEVELOPER_MODE_CURSOR: SyncCursor = { prefix: 'developerMode.cursor.v1.', strict: true };

function stampedOrder(kind: OrderKind, order: readonly string[]): OrderStateContent {
  return { order: [...order], at: stampLocal(kind) };
}

function orderKind(kind: OrderKind, setting: SyncedSetting<readonly string[]>): AppSyncKind {
  return defineAppSyncKind({
    kind,
    watch: (publish) => {
      setting.onLocalChange(({ accountId, state }) => {
        const content = stampedOrder(kind, state);
        publish({ key: kind, accountId, content: () => Promise.resolve(content) });
      });
    },
    apply: async (accountId, replay) => {
      const state = replay[kind];
      if (state !== null && takeIfNewer(kind, state.at)) await setting.applyRemote(accountId, state.order);
    },
    snapshot: async (accountId) => {
      const order = await setting.load(accountId);
      return order === null || order.length === 0 ? null : stampedOrder(kind, order);
    },
  });
}

async function applyLatest<K extends LatestKind>(kind: K, setting: SyncedSetting<SyncContents[K]>, accountId: string, replay: SyncReplay) {
  const latest: LatestReplay = replay;
  const state = latest[kind];
  if (state !== null) await setting.applyRemote(accountId, state);
}

function latestKind<K extends Exclude<LatestKind, 'developerMode'>>(
  kind: K,
  setting: SyncedSetting<SyncContents[K]>,
  delayMs?: number,
): AppSyncKind {
  return defineAppSyncKind({
    kind,
    watch: (publish) => {
      setting.onLocalChange(({ accountId, state }) => {
        publish({ key: kind, accountId, ...(delayMs === undefined ? {} : { delayMs }), content: () => Promise.resolve(state) });
      });
    },
    apply: (accountId, replay) => applyLatest(kind, setting, accountId, replay),
    snapshot: setting.load,
  });
}

function developerModeJob(accountId: string): KindJob<SyncContents['developerMode']> {
  return { key: `developerMode:${accountId}`, accountId, content: () => developerModeSync.load(accountId) };
}

const DEVELOPER_MODE_KIND = defineAppSyncKind({
  kind: 'developerMode',
  cursor: DEVELOPER_MODE_CURSOR,
  watch: (publish) => {
    developerModeSync.onLocalChange(({ accountId }) => {
      publish(developerModeJob(accountId));
    });
  },
  apply: (accountId, replay) => applyLatest('developerMode', developerModeSync, accountId, replay),
  snapshot: developerModeSync.load,
  republish: (publish, accountId) => {
    publish(developerModeJob(accountId));
  },
});

export const SETTING_KINDS: readonly AppSyncKind[] = [
  orderKind('board', boardOrderSync),
  orderKind('categoryOrder', categoryOrderSync),
  latestKind('search', searchStateSync, SEARCH_DEBOUNCE_MS),
  latestKind('homeView', homeViewSync),
  latestKind('dashboard', dashboardSync),
  DEVELOPER_MODE_KIND,
];
