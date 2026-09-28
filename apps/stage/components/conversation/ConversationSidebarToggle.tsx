import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { toggleMemberList } from '../../lib/memberList';
import { useConversationSidebarState } from './ConversationSidebar';

export function ConversationSidebarToggle({ isGroup, peerAddress }: {
  isGroup: boolean; peerAddress: string | null;
}): React.ReactElement | null {
  const state = useConversationSidebarState(isGroup, peerAddress);
  const { text, link } = usePalette();
  const hover = useHover();
  if (state === undefined) return null;
  const open = state === 'shown';
  const label = `${open ? 'Hide' : 'Show'} ${isGroup ? 'member list' : 'user profile'}`;
  return (
    <HoverTooltip label={label} placement="below">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-pressed={open}
        accessibilityState={{ expanded: open }}
        onPress={toggleMemberList}
        hitSlop={8}
        {...hover.hoverProps}
      >
        <Glyph icon={isGroup ? IconGroup1 : IconPeople} size={24} color={hover.hovered ? link : text}/>
      </Pressable>
    </HoverTooltip>
  );
}
