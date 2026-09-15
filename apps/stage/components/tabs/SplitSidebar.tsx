
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';
import { HomeScreen } from './HomeScreen';
import { WebTabRail } from './WebTabRail';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { usePaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';
import { isSplitRoute, isTabRoute } from './splitRoutes';

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
  const inset = useTopChromeInset();
  const { border } = usePalette();
  const unreadBadge = unreadBadgeLabel(useTotalUnread());
  if (!active) return null;
  return (
    <>
      {isTabRoute(pathname) ? null : <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>}
      <Box
        surface="surface"
        width={paneWidth}
        style={[
          pinnedEdges({ top: inset, bottom: 0, left: WEB_TAB_RAIL_WIDTH }, 3),
          { borderRightWidth: 1, borderRightColor: border },
        ]}
>
        <HomeScreen pane/>
        <PaneResizeHandle/>
      </Box>
    </>
  );
}
