import {
  dashboardSchema,
  EMPTY_DASHBOARD,
  type DashboardContent,
  type DashboardSource,
  type DashboardWidget,
  type DashboardWidth,
  type LiveSource,
} from '@stage-labs/client/xmtp/sync/dashboard';
import {
  addFrameWidget,
  addLiveWidget,
  frameWidgetAdd,
  liveWidgetAdd,
  removedLiveIds,
  type FrameWidgetAdd,
} from '../../components/dashboard/dashboard.model';
import { forgetLiveSnapshots } from './liveSnapshots';
import { syncedSetting } from '../sync/setting';
import { editDashboard, receiveDashboard } from '../syncedSettings.model';
import { randomHex } from '@stage-labs/client/ids';

function receiveForgetting(current: DashboardContent, incoming: DashboardContent, accountId: string): DashboardContent {
  const next = receiveDashboard(current, incoming);
  forgetLiveSnapshots(accountId, removedLiveIds(current.widgets, next.widgets));
  return next;
}

const dashboard = syncedSetting<DashboardContent>(
  { key: 'dashboard.v1.', default: EMPTY_DASHBOARD, schema: dashboardSchema, perAccount: true },
  { receive: receiveForgetting },
);
const { prefs } = dashboard;

export const dashboardSync = dashboard.sync;

export const useDashboard = prefs.use;

export const dashboardAccountId = (): string | null => prefs.accountId();

export const useDashboardLoaded = dashboard.useLoaded;

export function changeDashboard(change: (widgets: DashboardWidget[]) => DashboardWidget[]): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  const current = prefs.get();
  const next = editDashboard(current, change(current.widgets), Date.now());
  if (next === current) return;
  prefs.set(next);
  forgetLiveSnapshots(accountId, removedLiveIds(current.widgets, next.widgets));
  dashboard.changedLocally(accountId, next);
}

interface WidgetAdded {
  outcome: FrameWidgetAdd;
  id: string;
}

async function addWidget(
  outcomeOf: (widgets: readonly DashboardWidget[]) => FrameWidgetAdd,
  add: (widgets: DashboardWidget[], id: string) => DashboardWidget[],
): Promise<WidgetAdded> {
  await prefs.load();
  if (prefs.accountId() === null) throw new Error('No active account for the dashboard');
  const id = randomHex(8);
  const outcome = outcomeOf(prefs.get().widgets);
  if (outcome === 'added') changeDashboard((widgets) => add(widgets, id));
  return { outcome, id };
}

export async function addFrameToDashboard(source: DashboardSource, width: DashboardWidth): Promise<FrameWidgetAdd> {
  return (
    await addWidget(
      (widgets) => frameWidgetAdd(widgets, source),
      (widgets, id) => addFrameWidget(widgets, id, source, width),
    )
  ).outcome;
}

export function addLiveToDashboard(source: LiveSource, width: DashboardWidth): Promise<WidgetAdded> {
  return addWidget(
    (widgets) => liveWidgetAdd(widgets, source.url),
    (widgets, id) => addLiveWidget(widgets, id, source, width),
  );
}
