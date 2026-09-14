import { Platform, type ViewStyle } from 'react-native';
import { Col } from '@stage-labs/kit/react-native/box';
import { PANE_LEFT_PAD } from './webChrome';

const WEB_CONTENT_MAX_WIDTH = 900;

export const WEB_EDGE_CONTENT: ViewStyle = Platform.OS === 'web'
  ? { width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, marginHorizontal: 'auto' }
  : {};

export function WebContentFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col surface="surface" flex={1} width="100%" style={PANE_LEFT_PAD}>
      {children}
    </Col>
  );
}
