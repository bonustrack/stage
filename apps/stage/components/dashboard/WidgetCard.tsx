import { deleteNode } from '@stage-labs/client/nodes/publish';
import { DASHBOARD_LIVE_KIND, liveSourceOf, type DashboardWidget } from '@stage-labs/client/xmtp/readState';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuHeading, MenuRow } from '../MenuRows';
import { FrameMenuRows } from '../frame/FrameMenu';
import { capabilities } from '../../lib/capabilities';
import { changeDashboard } from '../../lib/dashboard';
import { linkProxyBase } from '../../lib/linkProxy';
import { refreshLiveWidget } from '../../lib/liveWidget';
import { HEIGHT_OPTIONS, WIDTH_OPTIONS, removeWidget, resizeWidget } from './dashboard.model';
import { FrameWidget } from './FrameWidget';
import { LiveWidget } from './LiveWidget';
import { NODE_DELETE_FAILED, ownsHostedNode } from './liveWidget.model';
import type { WidgetGrip } from './widgetParts';

async function removeWithNode(widgetId: string, key: string): Promise<void> {
  if (await deleteNode(linkProxyBase(), key) || await capabilities.confirm(NODE_DELETE_FAILED)) {
    changeDashboard(widgets => removeWidget(widgets, widgetId));
  }
}

export function WidgetMenu({ widget, anchor, onClose }: {
  widget: DashboardWidget; anchor: MenuPoint | null; onClose: () => void;
}): React.ReactElement {
  const pick = (change: (widgets: DashboardWidget[]) => DashboardWidget[]): void => {
    onClose();
    changeDashboard(change);
  };
  const live = widget.kind === DASHBOARD_LIVE_KIND ? liveSourceOf(widget) : null;
  const nodeKey = live !== null && ownsHostedNode(live) ? live.key : null;
  const remove = (): void => {
    if (nodeKey === null) {
      pick(widgets => removeWidget(widgets, widget.id));
      return;
    }
    onClose();
    void removeWithNode(widget.id, nodeKey);
  };
  return (
    <AnchoredMenu visible={anchor !== null} onClose={onClose} anchor={anchor}>
      {live === null ? null : <FrameMenuRows url={live.url} onRefresh={() => { refreshLiveWidget(widget.id); }} onClose={onClose} />}
      <MenuHeading text="Width" />
      {WIDTH_OPTIONS.map(option => (
        <MenuRow key={option.value} label={option.label} selected={widget.w === option.value}
          onPress={() => { pick(widgets => resizeWidget(widgets, widget.id, { w: option.value })); }} />
      ))}
      <MenuHeading text="Height" />
      {HEIGHT_OPTIONS.map(option => (
        <MenuRow key={option.value} label={option.label} selected={widget.h === option.value}
          onPress={() => { pick(widgets => resizeWidget(widgets, widget.id, { h: option.value })); }} />
      ))}
      <MenuRow icon={IconTrashCan} label={nodeKey === null ? 'Remove widget' : 'Remove widget and node'} danger onPress={remove} />
    </AnchoredMenu>
  );
}

export function WidgetCard({ widget, onMenu, grip }: {
  widget: DashboardWidget; onMenu: (anchor: MenuPoint) => void; grip: WidgetGrip;
}): React.ReactElement {
  if (widget.kind === DASHBOARD_LIVE_KIND) return <LiveWidget widgetId={widget.id} source={liveSourceOf(widget)} onMenu={onMenu} grip={grip} />;
  return <FrameWidget source={widget.source} onMenu={onMenu} grip={grip} />;
}
