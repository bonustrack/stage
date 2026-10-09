
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box, pinnedEdges, SCROLLBAR_ON_HOVER } from '../layout';
import { usePalette } from '../../lib/theme';
import { useVisibleUnreadCount } from '../home/unreadCount';
import { unreadBadgeLabel } from '../../lib/format';
import { HomeScreen } from '../home/HomeScreen';
import { WebTabRail } from './WebTabRail';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { channelsPaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';
import { isRailOnlyRoute, isSplitRoute, isTabRoute } from './splitRoutes';
import { useBoardHome } from './boardHome';

function usePaneScope(scope: string | null): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (scope === null) return;
    document.documentElement.dataset.stagepane = scope;
    return () => { delete document.documentElement.dataset.stagepane; };
  }, [scope]);
}

function paneScopeOf(active: boolean, railOnly: boolean): string | null {
  if (active) return '1';
  return railOnly ? 'rail' : null;
}

function SidePane({ full, children }: { full: boolean; children: React.ReactNode }): React.ReactElement {
  const paneWidth = channelsPaneWidth.use();
  const inset = useTopChromeInset();
  const { border } = usePalette();
  return (
    <Box
      {...(full ? null : SCROLLBAR_ON_HOVER)}
      surface="surface"
      width={full ? undefined : paneWidth}
      style={[
        pinnedEdges({ top: inset, bottom: 0, left: WEB_TAB_RAIL_WIDTH, right: full ? 0 : undefined }, 3),
        full ? null : { borderRightWidth: 1, borderRightColor: border },
      ]}
>
      {children}
      {full ? null : <PaneResizeHandle pane={channelsPaneWidth} edge="right"/>}
    </Box>
  );
}

export function SplitSidebar({ visible }: { visible: boolean }): React.ReactElement | null {
  const rail = useWebTabRail();
  const pathname = usePathname();
  const boardHome = useBoardHome();
  const active = visible && rail && isSplitRoute(pathname);
  const railOnly = visible && rail && isRailOnlyRoute(pathname);
  usePaneScope(paneScopeOf(active, railOnly));
  const unreadBadge = unreadBadgeLabel(useVisibleUnreadCount());
  if (!active && !railOnly) return null;
  return (
    <>
      {isTabRoute(pathname) ? null : <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>}
      <SidePane full={railOnly}>
        <HomeScreen pane board={boardHome}/>
      </SidePane>
    </>
  );
}
