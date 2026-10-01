
import { Box, Row, STICKY_UNDER_CHROME, PAGE_GUTTER, stickyAt } from './layout';
import type { ListScrollMode } from './layout/VirtualList.types';
import { usePalette } from '../lib/theme';
import { usePathname } from 'expo-router';
import { useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../lib/webLayout';
import { isSplitRoute } from './tabs/splitRoutes';
import { GradientFade } from './GradientFade';

export const TOPNAV_HEIGHT = 52;
export const TOPNAV_FADE = 8;

const FADE_OVERLAY = { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 } as const;

export function TopnavFade({ scroll, stickyTop }: { scroll: ListScrollMode; stickyTop: string }): React.ReactElement {
  const { toolbarBg } = usePalette();
  const sticky = scroll === 'window' ? stickyAt(stickyTop, 2) : null;
  return (
    <Box pointerEvents="none" height={TOPNAV_FADE} margin={sticky === null ? undefined : { bottom: -TOPNAV_FADE }} style={sticky ?? FADE_OVERLAY}>
      <GradientFade color={toolbarBg} height={TOPNAV_FADE} solid="top"/>
    </Box>
  );
}

export function Topnav({ left, right, inline, bordered = true }: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  inline?: boolean;
  bordered?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  const pathname = usePathname();
  const rail = useWebTabRail() && inline !== true;
  const railOverlaps = rail && !isSplitRoute(pathname);

  const bar = (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: PAGE_GUTTER, left: railOverlaps ? WEB_TAB_RAIL_WIDTH + PAGE_GUTTER : PAGE_GUTTER }}
      align="center"
      justify="between"
      surface="toolbar"
      style={bordered ? { borderBottomWidth: 1, borderBottomColor: border } : undefined}
    >
      <Row align="center" gap={8}>
        {left}
      </Row>
      {right ? (
        <Row align="center" gap={18}>
          {right}
        </Row>
      ) : null}
    </Row>
  );
  if (inline === true) return bar;
  return <Box style={STICKY_UNDER_CHROME}>{bar}</Box>;
}
