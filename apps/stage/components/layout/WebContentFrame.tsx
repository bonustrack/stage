
import { Platform } from 'react-native';
import { Col } from '@stage-labs/kit/react-native/box';

export const WEB_CONTENT_MAX_WIDTH = 900;

export function WebContentFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col surface="surface" flex={1} align="center">
      <Col flex={1} width="100%" maxWidth={WEB_CONTENT_MAX_WIDTH}>
        {children}
      </Col>
    </Col>
  );
}
