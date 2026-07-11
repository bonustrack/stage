
import { Platform } from 'react-native';
import { Col } from './Box';

export function WebFullBleed({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col width="100vw" margin={{ left: '-50vw' }} style={{ position: 'relative', left: '50%' }}>
      {children}
    </Col>
  );
}
