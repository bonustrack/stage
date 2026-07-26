
import { TopnavIdentity } from './TopnavIdentity';
import { Row, WebFullBleed } from './layout';
import { usePalette } from '../lib/theme';
import { useWebTabRail, WEB_TAB_RAIL_WIDTH } from './tabs/useWebTabRail';

export const TOPNAV_HEIGHT = 52;

export function Topnav({ left, right, inline }: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  inline?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  const rail = useWebTabRail() && inline !== true;

  const bar = (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: 16, left: rail ? WEB_TAB_RAIL_WIDTH + 16 : 16 }}
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
