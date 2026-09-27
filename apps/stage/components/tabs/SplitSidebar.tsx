
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';
import { HomeScreen } from '../home/HomeScreen';
import { BoardScreen } from '../board/BoardScreen';
import { WebTabRail } from './WebTabRail';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { usePaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';
import { isBoardRoute, isRailOnlyRoute, isSplitRoute, isTabRoute } from './splitRoutes';

const SCROLLBAR_ON_HOVER = { dataSet: { stagescrollbarhover: '1' } };

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
  const paneWidth = usePaneWidth();
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
      {full ? null : <PaneResizeHandle/>}
    </Box>
  );
}

export function SplitSidebar({ visible }: { visible: boolean }): React.ReactElement | null {
  const rail = useWebTabRail();
  const pathname = usePathname();
  const active = visible && rail && isSplitRoute(pathname);
  const railOnly = visible && rail && isRailOnlyRoute(pathname);
  usePaneScope(paneScopeOf(active, railOnly));
  const unreadBadge = unreadBadgeLabel(useTotalUnread());
  if (!active && !railOnly) return null;
  return (
    <>
      {isTabRoute(pathname) ? null : <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>}
      <SidePane full={railOnly}>
        {isBoardRoute(pathname) ? <BoardScreen pane/> : <HomeScreen pane/>}
      </SidePane>
    </>
  );
}
