import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { menuPointBelowEnd } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { OverflowButton, SMALL_OVERFLOW_ICON } from '../MenuRows';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { Column, Row } from '../layout';

const OUTLINE_PADDING = 12;
const HEADER_HEIGHT = 28;

export type WidgetGrip = (handle: React.ReactElement) => React.ReactElement;

function WidgetTitle({ title, onOpen }: { title: string; onOpen?: () => void }): React.ReactElement {
  const { sub, link } = usePalette();
  const name = useHover();
  return (
    <Pressable
      onPress={onOpen}
      disabled={onOpen === undefined}
      accessibilityRole={onOpen === undefined ? undefined : 'link'}
      accessibilityLabel={onOpen === undefined ? title : `Open ${title}`}
      style={{ flexShrink: 1, maxWidth: '100%' }}
      {...name.hoverProps}
    >
      <Text text={title} size="2xs" fontWeight="semibold" color={name.hovered && onOpen ? link : sub} truncate />
    </Pressable>
  );
}

export function WidgetHeader({
  title,
  onOpen,
  status,
  onMenu,
}: {
  title?: string;
  onOpen?: () => void;
  status?: string | null;
  onMenu: (anchor: MenuPoint) => void;
}): React.ReactElement {
  const { sub } = usePalette();
  return (
    <Row align="center" gap={8} height={HEADER_HEIGHT}>
      <Row weight={1} minWidth={0} align="center" gap={6}>
        {title === undefined ? null : <WidgetTitle title={title} onOpen={onOpen} />}
        {status === undefined || status === null ? null : (
          <Column weight={1} minWidth={0}>
            <Text text={status} size="2xs" color="secondary" truncate />
          </Column>
        )}
      </Row>
      <OverflowButton
        color={sub}
        label="Widget options"
        size={SMALL_OVERFLOW_ICON}
        onPress={(e) => {
          onMenu(menuPointBelowEnd(e));
        }}
      />
    </Row>
  );
}

export function Unavailable({ title, detail }: { title: string; detail?: string }): React.ReactElement {
  const { border } = usePalette();
  const edge = { width: 1, color: border, style: 'dashed' };
  return (
    <Column
      weight={1}
      gap={4}
      padding={OUTLINE_PADDING}
      radius={BLOCK_RADIUS_DEFAULT}
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      align="center"
      justify="center"
    >
      <Text text={title} size="xs" fontWeight="semibold" color="link" textAlign="center" maxLines={2} />
      {detail === undefined ? null : <Text text={detail} size="2xs" color="secondary" textAlign="center" maxLines={3} />}
    </Column>
  );
}
