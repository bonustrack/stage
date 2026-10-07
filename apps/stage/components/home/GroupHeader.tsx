import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, LIST_TOP_GAP, PAGE_GUTTER } from '../layout';
import { Eyebrow } from '../Eyebrow';
import { UnreadBadge } from '../UnreadBadge';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import type { ChannelGroupHeader } from './groups.model';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';

const CHEVRON_SIZE = 14;
const TITLE_SIZE = '2xs';
const TITLE_LINE_HEIGHT = 17;
const TITLE_STYLE = { flexShrink: 1, lineHeight: TITLE_LINE_HEIGHT } as const;
const BOTTOM_GAP = 6;
export const GROUP_HEADER_HEIGHT = LIST_TOP_GAP + TITLE_LINE_HEIGHT + BOTTOM_GAP;

export function GroupHeader({ header, onToggle }: {
  header: ChannelGroupHeader; onToggle: (key: string) => void;
}): React.ReactElement {
  const { sub, link } = usePalette();
  const { hovered, hoverProps } = useHover();
  const tint = hovered ? link : undefined;
  return (
    <Pressable
      onPress={() => { onToggle(header.key); }}
      accessibilityRole="button"
      aria-expanded={!header.collapsed}
      accessibilityLabel={`${header.title}, ${header.count} chats`}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, height: GROUP_HEADER_HEIGHT,
        paddingHorizontal: PAGE_GUTTER, paddingTop: LIST_TOP_GAP, paddingBottom: BOTTOM_GAP, opacity: pressed ? 0.7 : 1,
      })}
    >
      <Glyph icon={header.collapsed ? IconChevronRight : IconChevronBottom} size={CHEVRON_SIZE} color={tint ?? sub}/>
      <Eyebrow size={TITLE_SIZE} color={tint} truncate style={TITLE_STYLE}>{header.title.toUpperCase()}</Eyebrow>
      <Box flex={1}/>
      {header.collapsed && header.unread > 0 ? <UnreadBadge count={header.unread}/> : null}
    </Pressable>
  );
}
