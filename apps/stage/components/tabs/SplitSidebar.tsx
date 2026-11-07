import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { HomeScreen } from '../home/HomeScreen';
import { WebTabRail } from './WebTabRail';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../layout/webLayout';
import { channelsPaneWidth } from '../layout/paneWidth';
import { PaneResizeHandle } from '../layout/PaneResizeHandle';
import { isRailOnlyRoute, isSplitRoute, isTabRoute } from './splitRoutes';
import { useBoardHome } from './boardHome';
import { Column, pinnedEdges, SCROLLBAR_ON_HOVER } from '../layout';
import { setPaneScope } from '../layout/webChrome';
import type { PaneScope } from '../layout/webChrome.core';

function usePaneScope(scope: PaneScope | null): void {
  useEffect(() => {
    if (scope === null) return;
    setPaneScope(scope);
    return () => {
      setPaneScope(null);
    };
  }, [scope]);
}

function SidePane({ full, children }: { full: boolean; children: React.ReactNode }): React.ReactElement {
  const paneWidth = channelsPaneWidth.use();
  const inset = useTopChromeInset();
  const { border } = usePalette();
  return (
    <Column
      {...(full ? null : SCROLLBAR_ON_HOVER)}
      surface="surface"
      width={full ? undefined : paneWidth}
      style={[
        pinnedEdges({ top: inset, bottom: 0, left: WEB_TAB_RAIL_WIDTH, right: full ? 0 : undefined }, 3),
        full ? null : { borderRightWidth: 1, borderRightColor: border },
      ]}
    >
      {children}
      {full ? null : <PaneResizeHandle pane={channelsPaneWidth} edge="right" />}
    </Column>
  );
}

export function SplitSidebar({ visible }: { visible: boolean }): React.ReactElement | null {
  const rail = useWebTabRail();
  const pathname = usePathname();
  const boardHome = useBoardHome();
  const active = visible && rail && isSplitRoute(pathname);
  const railOnly = visible && rail && isRailOnlyRoute(pathname);
  usePaneScope(active ? '1' : railOnly ? 'rail' : null);
  if (!active && !railOnly) return null;
  return (
    <>
      {isTabRoute(pathname) ? null : <WebTabRail pathname={pathname} />}
      <SidePane full={railOnly}>
        <HomeScreen pane board={boardHome} />
      </SidePane>
    </>
  );
}
