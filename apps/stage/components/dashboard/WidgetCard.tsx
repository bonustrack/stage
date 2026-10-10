import { Text } from '@stage-labs/kit/react-native/text';
import { deleteNode } from '@stage-labs/client/nodes/publish';
import { frameSourceOf, liveSourceOf, type DashboardWidget, type LiveSource } from '@stage-labs/client/xmtp/readState';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuHeading, MenuRow } from '../MenuRows';
import { Col, Row } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { changeDashboard } from '../../lib/dashboard';
import { ignore } from '../../lib/errorPolicy';
import { linkProxyBase } from '../../lib/linkProxy';
import { refreshLiveWidget } from '../../lib/liveWidget';
import { HEIGHT_OPTIONS, WIDTH_OPTIONS, removeWidget, resizeWidget, widgetKindOf, widgetSizeLabel } from './dashboard.model';
import { FrameWidget } from './FrameWidget';
import { LiveWidget } from './LiveWidget';
import { ownsHostedNode } from './liveWidget.model';
import { WidgetMenuButton, WidgetOutline, type WidgetGrip } from './widgetParts';

function LiveRows({ source, widgetId, onClose }: { source: LiveSource; widgetId: string; onClose: () => void }): React.ReactElement {
  return (
    <>
      <MenuRow icon={IconArrowRotateClockwise} label="Refresh" onPress={() => { onClose(); refreshLiveWidget(widgetId); }} />
      <MenuRow icon={IconSquareBehindSquare1} label="Copy link" onPress={() => { onClose(); capabilities.copy('Link', source.url); }} />
    </>
  );
}

export function WidgetMenu({ widget, anchor, onClose }: {
  widget: DashboardWidget; anchor: MenuPoint | null; onClose: () => void;
}): React.ReactElement {
  const pick = (change: (widgets: DashboardWidget[]) => DashboardWidget[]): void => {
    onClose();
    changeDashboard(change);
  };
  const live = liveSourceOf(widget);
  const ownNode = live !== null && ownsHostedNode(live);
  const remove = (): void => {
    pick(widgets => removeWidget(widgets, widget.id));
    if (ownNode) ignore(deleteNode(linkProxyBase(), live.key), 'cleanup');
  };
  return (
    <AnchoredMenu visible={anchor !== null} onClose={onClose} anchor={anchor}>
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
      {live === null ? null : <LiveRows source={live} widgetId={widget.id} onClose={onClose} />}
      <MenuRow icon={IconTrashCan} label={ownNode ? 'Remove widget and node' : 'Remove widget'} danger onPress={remove} />
    </AnchoredMenu>
  );
}

function EmptyWidget({ widget, onMenu, grip }: {
  widget: DashboardWidget; onMenu: (anchor: MenuPoint) => void; grip: WidgetGrip;
}): React.ReactElement {
  const unsupported = widgetKindOf(widget) === 'unsupported';
  return grip(
    <WidgetOutline>
      <Row align="start" gap={8}>
        <Col flex={1} gap={2}>
          <Text value={unsupported ? 'Unsupported widget' : 'Empty widget'} size="xs" weight="semibold" color="link" truncate />
          <Text value={unsupported ? 'Update Stage to show it.' : widgetSizeLabel(widget)} size="2xs" color="secondary" maxLines={2} />
        </Col>
        <WidgetMenuButton onMenu={onMenu} />
      </Row>
    </WidgetOutline>,
    true,
  );
}

export function WidgetCard({ widget, onMenu, grip }: {
  widget: DashboardWidget; onMenu: (anchor: MenuPoint) => void; grip: WidgetGrip;
}): React.ReactElement {
  const live = liveSourceOf(widget);
  if (live !== null) return <LiveWidget widgetId={widget.id} source={live} onMenu={onMenu} grip={grip} />;
  if (widgetKindOf(widget) !== 'frame') return <EmptyWidget widget={widget} onMenu={onMenu} grip={grip} />;
  return <FrameWidget source={frameSourceOf(widget)} onMenu={onMenu} grip={grip} />;
}
