import { Text } from '@stage-labs/kit/react-native/text';
import { frameSourceOf, type DashboardWidget } from '@stage-labs/client/xmtp/readState';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuHeading, MenuRow } from '../MenuRows';
import { Col, Row } from '../layout';
import { changeDashboard } from '../../lib/dashboard';
import { HEIGHT_OPTIONS, WIDTH_OPTIONS, removeWidget, resizeWidget, widgetKindOf, widgetSizeLabel } from './dashboard.model';
import { FrameWidget } from './FrameWidget';
import { WidgetMenuButton, WidgetOutline, type WidgetGrip } from './widgetParts';

export function WidgetMenu({ widget, anchor, onClose }: {
  widget: DashboardWidget; anchor: MenuPoint | null; onClose: () => void;
}): React.ReactElement {
  const pick = (change: (widgets: DashboardWidget[]) => DashboardWidget[]): void => {
    onClose();
    changeDashboard(change);
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
      <MenuRow icon={IconTrashCan} label="Remove widget" danger onPress={() => { pick(widgets => removeWidget(widgets, widget.id)); }} />
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
  if (widgetKindOf(widget) !== 'frame') return <EmptyWidget widget={widget} onMenu={onMenu} grip={grip} />;
  return <FrameWidget source={frameSourceOf(widget)} onMenu={onMenu} grip={grip} />;
}
