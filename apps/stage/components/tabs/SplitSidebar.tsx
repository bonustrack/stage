
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';
import { HomeScreen } from './HomeScreen';
import { WebTabRail } from './WebTabRail';
import { useWebTabRail, WEB_TAB_RAIL_WIDTH } from './useWebTabRail';
import { usePaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';

const DM_ROUTE = /^\/0x[a-fA-F0-9]{40}$/;

export function isSplitRoute(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/channel/') || DM_ROUTE.test(pathname);
}

function usePaneScope(active: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!active) return;
    document.documentElement.dataset.stagepane = '1';
    return () => { delete document.documentElement.dataset.stagepane; };
  }, [active]);
}

export function SplitSidebar({ visible }: { visible: boolean }): React.ReactElement | null {
  const rail = useWebTabRail();
  const pathname = usePathname();
  const active = visible && rail && isSplitRoute(pathname);
  usePaneScope(active);
  const paneWidth = usePaneWidth();
  const { border } = usePalette();
  const unreadBadge = unreadBadgeLabel(useTotalUnread());
  if (!active) return null;
  return (
    <>
      {pathname === '/' ? null : <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>}
      <Box
        surface="surface"
        width={paneWidth}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: WEB_TAB_RAIL_WIDTH, zIndex: 3,
          borderRightWidth: 1, borderRightColor: border,
        }}
>
        <HomeScreen pane/>
        <PaneResizeHandle/>
      </Box>
    </>
  );
}
