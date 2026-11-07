import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { usePalette } from '../../lib/theme';
import { unreadBadgeLabel } from '../../lib/format';
import { UnreadBadgeLabel } from '../chatRow/UnreadBadge';
import { useVisibleUnreadCount } from '../home/unreadCount';
import { Column } from '../layout';

export const TAB_ICON_FRAME = { width: 31, height: 28 } as const;

const TAB_BADGE_POSITION = { position: 'absolute', top: -3, right: -3 } as const;

export function useChatsTabBadge(): string | undefined {
  return unreadBadgeLabel(useVisibleUnreadCount());
}

export function TabIcon({ icon, active, badge }: { icon: CentralIcon; active: boolean; badge?: string }): React.ReactElement {
  const pal = usePalette();
  return (
    <Column width={TAB_ICON_FRAME.width} height={TAB_ICON_FRAME.height} align="center" justify="center">
      <Glyph icon={icon} size={24} color={active ? pal.link : pal.text} />
      {badge !== undefined ? <UnreadBadgeLabel text={badge} style={TAB_BADGE_POSITION} /> : null}
    </Column>
  );
}
