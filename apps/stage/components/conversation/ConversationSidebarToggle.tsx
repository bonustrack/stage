import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconSidebarSimpleRightWide } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSidebarSimpleRightWide';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { toggleMemberList, useMemberListOpen } from '../../lib/memberList';
import { useWebTabRail } from '../../lib/webLayout';

const LABEL = 'Toggle panel';

export function ConversationSidebarToggle({ isGroup, peerAddress }: {
  isGroup: boolean; peerAddress: string | null;
}): React.ReactElement | null {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  const { text, link } = usePalette();
  const hover = useHover();
  if (!wide || (!isGroup && !peerAddress)) return null;
  return (
    <HoverTooltip label={LABEL} placement="below">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL}
        aria-pressed={open}
        accessibilityState={{ expanded: open }}
        onPress={toggleMemberList}
        hitSlop={8}
        {...hover.hoverProps}
      >
        <Glyph icon={IconSidebarSimpleRightWide} size={24} color={hover.hovered ? link : text}/>
      </Pressable>
    </HoverTooltip>
  );
}
