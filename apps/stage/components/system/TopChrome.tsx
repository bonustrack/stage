import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Box } from '../layout';
import { isSplitRoute } from '../tabs/splitRoutes';
import { usePalette } from '../../lib/theme';
import { useTopChromeInset, useWebTabRail, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';

const DRAG_REGION = { dataSet: { stagedrag: '1' } };
const CHROME_LAYER = 50;
const PANEL_RADIUS = 8;

export function TopChrome({ decorated }: { decorated: boolean }): React.ReactElement | null {
  const inset = useTopChromeInset();
  const wide = useWebTabRail() && decorated;
  const pathname = usePathname();
  const railed = wide && isSplitRoute(pathname);
  const { border } = usePalette();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--stage-top-inset', `${inset}px`);
  }, [inset]);
  if (inset === 0) return null;
  const edge = { width: 1, color: border };
  return (
    <>
      <Box
        height={inset}
        surface={wide ? 'toolbar' : 'none'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: CHROME_LAYER }}
        {...DRAG_REGION}
      />
      {wide ? (
        <Box
          pointerEvents="none"
          border={railed ? { top: edge, left: edge } : { top: edge }}
          style={{
            position: 'absolute', top: inset, bottom: 0, right: 0, zIndex: CHROME_LAYER,
            left: railed ? WEB_TAB_RAIL_WIDTH - 1 : 0, borderTopLeftRadius: railed ? PANEL_RADIUS : 0,
          }}
        />
      ) : null}
    </>
  );
}
