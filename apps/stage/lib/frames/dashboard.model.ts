import { NODES_HOST } from '@stage-labs/client/nodes/hosting';
import {
  DASHBOARD_FRAME_KIND,
  DASHBOARD_LIVE_KIND,
  DASHBOARD_MAX_WIDGETS,
  type DashboardHeight,
  type DashboardSource,
  type DashboardWidget,
  type DashboardWidth,
  type LiveSource,
} from '@stage-labs/client/xmtp/sync/dashboard';

interface WidgetSize {
  w?: DashboardWidth;
  h?: DashboardHeight;
}

export function canAddWidget(widgets: readonly DashboardWidget[]): boolean {
  return widgets.length < DASHBOARD_MAX_WIDGETS;
}

const FRAME_WIDGET_HEIGHT: DashboardHeight = 3;

export type FrameWidgetAdd = 'added' | 'exists' | 'full';

export const FRAME_ADD_TOASTS: Readonly<Record<FrameWidgetAdd, string>> = {
  added: 'Added to your dashboard',
  exists: 'Already on your dashboard',
  full: 'Your dashboard is full',
};

const HOSTED_NODE_NOTE = 'That code does not see your account. Images it shows load from their own sites, which see your IP address.';

export function liveConfirmOf(host: string): { title: string; message: string; confirmLabel: string } {
  const message =
    host === NODES_HOST
      ? `It runs code a Stage user put on ${host}, every minute while your Dashboard is open. ${HOSTED_NODE_NOTE}`
      : `It loads from ${host} every minute while your Dashboard is open. That site sees your IP address, not your account.`;
  return { title: 'Add a live widget?', message, confirmLabel: 'Add' };
}

function sameSource(widget: DashboardWidget, source: DashboardSource): boolean {
  if (widget.kind !== DASHBOARD_FRAME_KIND) return false;
  return widget.source.conversationId === source.conversationId && widget.source.messageId === source.messageId;
}

export function frameWidgetAdd(widgets: readonly DashboardWidget[], source: DashboardSource): FrameWidgetAdd {
  if (widgets.some((widget) => sameSource(widget, source))) return 'exists';
  return canAddWidget(widgets) ? 'added' : 'full';
}

export function addFrameWidget(widgets: DashboardWidget[], id: string, source: DashboardSource, w: DashboardWidth): DashboardWidget[] {
  if (frameWidgetAdd(widgets, source) !== 'added' || widgets.some((widget) => widget.id === id)) return widgets;
  return [...widgets, { id, w, h: FRAME_WIDGET_HEIGHT, kind: DASHBOARD_FRAME_KIND, source }];
}

export function liveWidgetAdd(widgets: readonly DashboardWidget[], url: string): FrameWidgetAdd {
  if (widgets.some((widget) => widget.kind === DASHBOARD_LIVE_KIND && widget.source.url === url)) return 'exists';
  return canAddWidget(widgets) ? 'added' : 'full';
}

export function addLiveWidget(widgets: DashboardWidget[], id: string, source: LiveSource, w: DashboardWidth): DashboardWidget[] {
  if (liveWidgetAdd(widgets, source.url) !== 'added' || widgets.some((widget) => widget.id === id)) return widgets;
  const widget: DashboardWidget = {
    id,
    w,
    h: FRAME_WIDGET_HEIGHT,
    kind: DASHBOARD_LIVE_KIND,
    source: { url: source.url },
    key: source.key,
  };
  return [...widgets, source.origin === undefined ? widget : { ...widget, origin: source.origin }];
}

export function removedLiveIds(before: readonly DashboardWidget[], after: readonly DashboardWidget[]): string[] {
  const kept = new Set(after.map((widget) => widget.id));
  return before.filter((widget) => widget.kind === DASHBOARD_LIVE_KIND && !kept.has(widget.id)).map((widget) => widget.id);
}

export function removeWidget(widgets: DashboardWidget[], id: string): DashboardWidget[] {
  const next = widgets.filter((widget) => widget.id !== id);
  return next.length === widgets.length ? widgets : next;
}

export function resizeWidget(widgets: DashboardWidget[], id: string, size: WidgetSize): DashboardWidget[] {
  const index = widgets.findIndex((widget) => widget.id === id);
  const current = widgets[index];
  if (current === undefined) return widgets;
  const next = { ...current, w: size.w ?? current.w, h: size.h ?? current.h };
  if (next.w === current.w && next.h === current.h) return widgets;
  return widgets.map((widget, i) => (i === index ? next : widget));
}

export function moveWidget(widgets: DashboardWidget[], id: string, targetId: string): DashboardWidget[] {
  const from = widgets.findIndex((widget) => widget.id === id);
  const to = widgets.findIndex((widget) => widget.id === targetId);
  const moved = widgets[from];
  if (moved === undefined || to === -1 || from === to) return widgets;
  const next = widgets.filter((_, i) => i !== from);
  next.splice(to, 0, moved);
  return next;
}
