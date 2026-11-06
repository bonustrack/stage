import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { menuPointBelowEnd } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { OverflowButton, SMALL_OVERFLOW_ICON } from '../MenuRows';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { Column, Row } from '../layout';

const HEADER_HEIGHT = 28;

function HeaderTitle({ title, onOpen }: { title: string; onOpen?: () => void }): React.ReactElement {
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

export function FrameHeader({
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
        {title === undefined ? null : <HeaderTitle title={title} onOpen={onOpen} />}
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
