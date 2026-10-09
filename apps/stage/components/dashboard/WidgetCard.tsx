import { Card } from '@stage-labs/kit/react-native/card';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import type { DashboardWidget } from '@stage-labs/client/xmtp/readState';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { AnchoredMenu, menuPointBelowEnd } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuHeading, MenuRow } from '../MenuRows';
import { useHover } from '../hover';
import { Col, Row } from '../layout';
import { changeDashboard } from '../../lib/dashboard';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { HEIGHT_OPTIONS, WIDTH_OPTIONS, removeWidget, resizeWidget, widgetSizeLabel } from './dashboard.model';

const CARD_PADDING = 12;
const MENU_ICON = 20;

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

export function WidgetCard({ widget, onMenu }: {
  widget: DashboardWidget; onMenu: (anchor: MenuPoint) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { sub, link } = usePalette();
  const trigger = useHover();
  return (
    <Card dark={dark} padding={CARD_PADDING} style={{ flex: 1 }}>
      <Row align="start" gap={8}>
        <Col flex={1} gap={2}>
          <Text value="Empty widget" size="xs" weight="semibold" color="link" truncate />
          <Text value={widgetSizeLabel(widget)} size="2xs" color="secondary" maxLines={2} />
        </Col>
        <Pressable onPress={(e) => { onMenu(menuPointBelowEnd(e)); }} hitSlop={10} accessibilityLabel="Widget options" {...trigger.hoverProps}>
          <Glyph icon={IconDotGrid1x3Vertical} size={MENU_ICON} color={trigger.hovered ? link : sub} />
        </Pressable>
      </Row>
    </Card>
  );
}
