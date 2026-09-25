
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';
import { HomeScreen } from '../home/HomeScreen';
import { WebTabRail } from './WebTabRail';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { usePaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';
import { isRailOnlyRoute, isSplitRoute, isTabRoute } from './splitRoutes';

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

export function SplitSidebar({ visible }: { visible: boolean }): React.ReactElement | null {
  const rail = useWebTabRail();
  const pathname = usePathname();
  const active = visible && rail && isSplitRoute(pathname);
  const railOnly = visible && rail && isRailOnlyRoute(pathname);
  usePaneScope(paneScopeOf(active, railOnly));
  const paneWidth = usePaneWidth();
  const inset = useTopChromeInset();
  const { border } = usePalette();
  const unreadBadge = unreadBadgeLabel(useTotalUnread());
  if (railOnly) return <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>;
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
