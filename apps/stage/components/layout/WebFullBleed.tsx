
import { Platform, type ViewStyle } from 'react-native';
import { Col } from '@stage-labs/kit/react-native/box';
import { WEB_CONTENT_MAX_WIDTH } from './WebContentFrame';

export const WEB_CHROME_WIDTH = 'calc(100vw - var(--stage-pane-left, 0px) - var(--stage-sbw, 0px))';

export const WEB_CHROME_SHIFT = 'calc(-50vw + var(--stage-pane-left, 0px))';

export function WebFullBleed({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col width={WEB_CHROME_WIDTH} margin={{ left: WEB_CHROME_SHIFT }} style={{ position: 'relative', left: '50%' }}>
      {children}
    </Col>
  );
}

export const WEB_EDGE_SCROLL: ViewStyle = Platform.OS === 'web'
  ? ({
      width: 'calc(100vw - var(--stage-pane-left, 0px))',
      left: '50%',
      marginLeft: WEB_CHROME_SHIFT,
      overflowY: 'scroll',
    } as unknown as ViewStyle)
  : {};

export const WEB_EDGE_CONTENT: ViewStyle = Platform.OS === 'web'
  ? { width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, marginHorizontal: 'auto' }
  : {};

export const WEB_EDGE_CONTENT_WIDE: ViewStyle = Platform.OS === 'web'
  ? { width: '100%' }
  : {};

export const WEB_STACK_SCROLL: ViewStyle = Platform.OS === 'web'
  ? { ...WEB_EDGE_SCROLL, position: 'absolute', top: 0, bottom: 0 }
  : {};

export const WEB_STACK_CONTENT_PAD: ViewStyle = Platform.OS === 'web' ? { paddingTop: 60 } : {};

export const WEB_CHROME_LAYER: ViewStyle = Platform.OS === 'web' ? { zIndex: 2 } : {};
