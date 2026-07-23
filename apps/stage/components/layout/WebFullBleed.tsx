
import { Platform, type ViewStyle } from 'react-native';
import { Col } from './Box';
import { WEB_CONTENT_MAX_WIDTH } from './WebContentFrame';

export function WebFullBleed({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col width="100vw" margin={{ left: '-50vw' }} style={{ position: 'relative', left: '50%' }}>
      {children}
    </Col>
  );
}

export const WEB_EDGE_SCROLL: ViewStyle = Platform.OS === 'web'
  ? ({ width: '100vw', left: '50%', marginLeft: '-50vw' } as unknown as ViewStyle)
  : {};

export const WEB_EDGE_CONTENT: ViewStyle = Platform.OS === 'web'
  ? { width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, marginHorizontal: 'auto' }
  : {};
