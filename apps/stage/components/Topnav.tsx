
import { Platform } from 'react-native';
import { TopnavIdentity } from './TopnavIdentity';
import { Row, WEB_CONTENT_MAX_WIDTH } from './layout';
import { usePalette } from '../lib/theme';

export const TOPNAV_HEIGHT = 52;

const WEB = Platform.OS === 'web';

export function Topnav({ left, right }: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();

  const content = (
    <>
      <Row align="center" gap={8}>
        {left ?? <TopnavIdentity/>}
      </Row>
      {right ? (
        <Row align="center" gap={18}>
          {right}
        </Row>
      ) : null}
    </>
  );

  if (WEB) {
    return (
      <Row
        height={TOPNAV_HEIGHT}
        align="center"
        justify="center"
        surface="toolbar"
        width="100vw"
        margin={{ left: '-50vw' }}
        style={{
          position: 'relative',
          left: '50%',
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Row
          width="100%"
          height="100%"
          maxWidth={WEB_CONTENT_MAX_WIDTH}
          padding={{ x: 16 }}
          align="center"
          justify="between"
        >
          {content}
        </Row>
      </Row>
    );
  }

  return (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: 16 }}
      align="center"
      justify="between"
      surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}
    >
      {content}
    </Row>
  );
}
