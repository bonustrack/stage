import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { toggleMemberList, useMemberListOpen } from '../../lib/memberList';
import { useWebTabRail } from '../../lib/webLayout';

export function ConversationSidebarToggle({ isGroup, peerAddress }: {
  isGroup: boolean; peerAddress: string | null;
}): React.ReactElement | null {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  const { text, link } = usePalette();
  const hover = useHover();
  if (!wide || (!isGroup && !peerAddress)) return null;
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
