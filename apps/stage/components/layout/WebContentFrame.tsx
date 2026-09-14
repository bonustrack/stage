import { Platform } from 'react-native';
import { Col } from '@stage-labs/kit/react-native/box';
import { PANE_LEFT_PAD } from './webChrome';

export function WebContentFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col surface="surface" flex={1} width="100%" style={PANE_LEFT_PAD}>
      {children}
    </Col>
  );
}
