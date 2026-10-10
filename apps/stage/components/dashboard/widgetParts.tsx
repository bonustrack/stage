import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';
import { menuPointBelowEnd } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useHover } from '../hover';
import { Box, Col, Row } from '../layout';
import { usePalette } from '../../lib/theme';

const MENU_ICON = 20;
const OUTLINE_PADDING = 12;
const HEADER_HEIGHT = 28;

export type WidgetGrip = (handle: React.ReactElement) => React.ReactElement;

function WidgetMenuButton({ onMenu }: { onMenu: (anchor: MenuPoint) => void }): React.ReactElement {
  const { sub, link } = usePalette();
  const trigger = useHover();
  return (
    <Pressable onPress={(e) => { onMenu(menuPointBelowEnd(e)); }} hitSlop={10} accessibilityLabel="Widget options" {...trigger.hoverProps}>
      <Glyph icon={IconDotGrid1x3Vertical} size={MENU_ICON} color={trigger.hovered ? link : sub} />
    </Pressable>
  );
}

export function WidgetHeader({ title, onOpen, status, onMenu }: {
  title: string; onOpen?: () => void; status?: string | null; onMenu: (anchor: MenuPoint) => void;
}): React.ReactElement {
  const { sub, link } = usePalette();
  const name = useHover();
  return (
    <Row align="center" gap={8} height={HEADER_HEIGHT}>
      <Row flex={1} minWidth={0} align="center" gap={6}>
        <Pressable
          onPress={onOpen} disabled={onOpen === undefined} accessibilityRole={onOpen === undefined ? undefined : 'link'}
          accessibilityLabel={onOpen === undefined ? title : `Open ${title}`}
          style={{ flexShrink: 1, maxWidth: '100%' }} {...name.hoverProps}
        >
          <Text value={title} size="2xs" weight="semibold" color={name.hovered && onOpen ? link : sub} truncate />
        </Pressable>
        {status === undefined || status === null ? null : (
          <Box flex={1} minWidth={0}><Text value={status} size="2xs" color="secondary" truncate /></Box>
        )}
      </Row>
      <WidgetMenuButton onMenu={onMenu} />
    </Row>
  );
}

export function Unavailable({ title, detail }: { title: string; detail?: string }): React.ReactElement {
  const { border } = usePalette();
  const edge = { width: 1, color: border, style: 'dashed' };
  return (
    <Col
      flex={1} gap={4} padding={OUTLINE_PADDING} radius={BLOCK_RADIUS_DEFAULT} border={{ top: edge, right: edge, bottom: edge, left: edge }}
      align="center" justify="center"
    >
      <Text value={title} size="xs" weight="semibold" color="link" textAlign="center" maxLines={2} />
      {detail === undefined ? null : <Text value={detail} size="2xs" color="secondary" textAlign="center" maxLines={3} />}
    </Col>
  );
}
