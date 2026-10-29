import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useHomeView } from '../../lib/homeView';
import { NewChatAction } from './NewChatAction';
import { Eyebrow } from '../Eyebrow';
import { UnreadBadge } from '../UnreadBadge';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { groupKeysOf, listKeyOf, type ChannelGroupHeader, type HomeListItem } from './groups.model';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { Column, Row, LIST_TOP_GAP, PAGE_GUTTER } from '../layout';

const CHEVRON_SIZE = 14;
const TITLE_SIZE = '2xs';
const TITLE_LINE_HEIGHT = 17;
const TITLE_STYLE = { flexShrink: 1, lineHeight: TITLE_LINE_HEIGHT } as const;
const BOTTOM_GAP = 6;
export const GROUP_HEADER_HEIGHT = LIST_TOP_GAP + TITLE_LINE_HEIGHT + BOTTOM_GAP;

export function useGroupHover(items: readonly HomeListItem[]): {
  hoveredGroup: string | null;
  wrapItem: (item: HomeListItem, node: React.ReactElement) => React.ReactElement;
} {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const keys = useMemo(() => groupKeysOf(items), [items]);
  const wrapItem = useCallback(
    (item: HomeListItem, node: React.ReactElement): React.ReactElement => {
      const key = keys.get(listKeyOf(item));
      if (Platform.OS !== 'web' || key === undefined) return node;
      return (
        <Column
          onPointerEnter={({ nativeEvent }) => {
            if (nativeEvent.pointerType !== 'touch') setHoveredGroup(key);
          }}
          onPointerLeave={() => {
            setHoveredGroup((current) => (current === key ? null : current));
          }}
        >
          {node}
        </Column>
      );
    },
    [keys],
  );
  return { hoveredGroup, wrapItem };
}

function GroupArrow({
  collapsed,
  sectionHovered,
  hovered,
  focused,
  color,
}: {
  collapsed: boolean;
  sectionHovered?: boolean;
  hovered: boolean;
  focused: boolean;
  color: string;
}): React.ReactElement {
  const shown = Platform.OS !== 'web' || collapsed || sectionHovered === true || hovered || focused;
  return (
    <Column style={{ opacity: shown ? 1 : 0 }}>
      <Glyph icon={collapsed ? IconChevronRight : IconChevronBottom} size={CHEVRON_SIZE} color={color} />
    </Column>
  );
}

export function GroupHeader({
  header,
  onToggle,
  sectionHovered,
  wrapToggle,
}: {
  header: ChannelGroupHeader;
  onToggle: (key: string) => void;
  sectionHovered?: boolean;
  wrapToggle: (node: React.ReactElement) => React.ReactElement;
}): React.ReactElement {
  const { sub, link } = usePalette();
  const { groupBy } = useHomeView();
  const { hovered, hoverProps } = useHover();
  const [focused, setFocused] = useState(false);
  const tint = hovered ? link : undefined;
  const toggle = (
    <Pressable
      onPress={() => {
        onToggle(header.key);
      }}
      accessibilityRole="button"
      aria-expanded={!header.collapsed}
      accessibilityLabel={`${header.title}, ${header.count} chats`}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: GROUP_HEADER_HEIGHT,
        paddingLeft: PAGE_GUTTER,
        paddingRight: 12,
        paddingTop: LIST_TOP_GAP,
        paddingBottom: BOTTOM_GAP,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Eyebrow size={TITLE_SIZE} color={tint} truncate style={TITLE_STYLE}>
        {header.title.toUpperCase()}
      </Eyebrow>
      <GroupArrow collapsed={header.collapsed} sectionHovered={sectionHovered} hovered={hovered} focused={focused} color={tint ?? sub} />
      <Column weight={1} />
      {header.collapsed && header.unread > 0 ? <UnreadBadge count={header.unread} /> : null}
    </Pressable>
  );
  return (
    <Row align="center" padding={{ right: PAGE_GUTTER }}>
      <Column weight={1}>{wrapToggle(toggle)}</Column>
      {groupBy !== 'none' && header.key !== 'dm' ? (
        <Column padding={{ top: LIST_TOP_GAP, bottom: BOTTOM_GAP }}>
          <NewChatAction by={groupBy} groupKey={header.key} title={header.title} />
        </Column>
      ) : null}
    </Row>
  );
}
