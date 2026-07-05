
import { TopnavIdentity } from './TopnavIdentity';
import { Row } from './layout';
import { usePalette } from '../lib/theme';

export const TOPNAV_HEIGHT = 52;

export function Topnav({ left, right }: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: 16 }}
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
}
