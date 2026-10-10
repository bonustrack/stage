import { bytesToHex } from 'viem';
import {
  dashboardSchema, EMPTY_DASHBOARD, type DashboardContent, type DashboardSource, type DashboardWidget, type DashboardWidth,
  type LiveSource,
} from '@stage-labs/client/xmtp/readState';
import {
  addFrameWidget, addLiveWidget, frameWidgetAdd, liveWidgetAdd, removedLiveIds, type FrameWidgetAdd,
} from '../components/dashboard/dashboard.model';
import { forgetLiveSnapshots } from './liveSnapshots';
import { createValueStore } from './persistedStore';
import { makeListeners, useStoreValue } from './storeCore';
import { editDashboard, receiveDashboard } from './syncedSettings.model';

function parseDashboard(raw: string): DashboardContent | undefined {
  try {
    const parsed = dashboardSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

const prefs = createValueStore<DashboardContent>({
  key: 'dashboard.v1.', default: EMPTY_DASHBOARD, deserialize: parseDashboard, serialize: JSON.stringify, perAccount: true,
});

export const useDashboard = prefs.use;

export const dashboardAccountId = (): string | null => prefs.accountId();

const dashboardLoaded = (): boolean => dashboardAccountId() !== null;

export const useDashboardLoaded = (): boolean => useStoreValue(prefs.subscribe, dashboardLoaded, prefs.loadAsync);

export interface DashboardChange {
  accountId: string;
  state: DashboardContent;
}

const localChanges = makeListeners<DashboardChange>();
export const onDashboardChanged = localChanges.subscribe;

export function changeDashboard(change: (widgets: DashboardWidget[]) => DashboardWidget[]): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  const current = prefs.get();
  const next = editDashboard(current, change(current.widgets), Date.now());
  if (next === current) return;
  prefs.set(next);
  forgetLiveSnapshots(accountId, removedLiveIds(current.widgets, next.widgets));
  localChanges.notify({ accountId, state: next });
}

function newWidgetId(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(8))).slice(2);
}

interface WidgetAdded { outcome: FrameWidgetAdd; id: string }

async function addWidget(
  outcomeOf: (widgets: readonly DashboardWidget[]) => FrameWidgetAdd, add: (widgets: DashboardWidget[], id: string) => DashboardWidget[],
): Promise<WidgetAdded> {
  await prefs.load();
  if (prefs.accountId() === null) throw new Error('No active account for the dashboard');
  const id = newWidgetId();
  const outcome = outcomeOf(prefs.get().widgets);
  if (outcome === 'added') changeDashboard(widgets => add(widgets, id));
  return { outcome, id };
}

export async function addFrameToDashboard(source: DashboardSource, width: DashboardWidth): Promise<FrameWidgetAdd> {
  const added = await addWidget(widgets => frameWidgetAdd(widgets, source), (widgets, id) => addFrameWidget(widgets, id, source, width));
  return added.outcome;
}

export function addLiveToDashboard(source: LiveSource, width: DashboardWidth): Promise<WidgetAdded> {
  return addWidget(widgets => liveWidgetAdd(widgets, source.url), (widgets, id) => addLiveWidget(widgets, id, source, width));
}

export async function loadDashboard(forAccount: string): Promise<DashboardContent | null> {
  const state = await prefs.loadFor(forAccount);
  return state.at > 0 ? state : null;
}

export function applyRemoteDashboard(forAccount: string, incoming: DashboardContent): Promise<void> {
  return prefs.updateFor(forAccount, (current) => {
    const next = receiveDashboard(current, incoming);
    forgetLiveSnapshots(forAccount, removedLiveIds(current.widgets, next.widgets));
    return next;
  });
}
