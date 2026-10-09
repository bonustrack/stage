import {
  dashboardSchema, EMPTY_DASHBOARD, type DashboardContent, type DashboardWidget,
} from '@stage-labs/client/xmtp/readState';
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

const dashboardLoaded = (): boolean => prefs.accountId() !== null;

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
  localChanges.notify({ accountId, state: next });
}

export async function loadDashboard(forAccount: string): Promise<DashboardContent | null> {
  const state = await prefs.loadFor(forAccount);
  return state.at > 0 ? state : null;
}

export function applyRemoteDashboard(forAccount: string, incoming: DashboardContent): Promise<void> {
  return prefs.updateFor(forAccount, current => receiveDashboard(current, incoming));
}
