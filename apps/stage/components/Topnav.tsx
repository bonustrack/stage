
import { TopnavIdentity } from './TopnavIdentity';
import { Row, WebFullBleed } from './layout';
import { usePalette } from '../lib/theme';
import { usePathname } from 'expo-router';
import { useWebTabRail, WEB_TAB_RAIL_WIDTH } from './tabs/useWebTabRail';
import { isSplitRoute } from './tabs/splitRoutes';

export const TOPNAV_HEIGHT = 52;

export function Topnav({ left, right, inline }: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  inline?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  const pathname = usePathname();
  const rail = useWebTabRail() && inline !== true;
  const railOverlaps = rail && !isSplitRoute(pathname);

  const bar = (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: 16, left: railOverlaps ? WEB_TAB_RAIL_WIDTH + 16 : 16 }}
      align="center"
      justify="between"
      surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}
    >
      <Row align="center" gap={8}>
        {left ?? <TopnavIdentity/>}
      </Row>
      {right ? (
        <Row align="center" gap={18}>
          {right}
        </Row>
      ) : null}
    </Row>
  );
  if (inline === true) return bar;
  return <WebFullBleed>{bar}</WebFullBleed>;
}
