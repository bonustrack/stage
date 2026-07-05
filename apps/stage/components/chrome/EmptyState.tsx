
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';

export function EmptyState({ title }: { title: string }): React.ReactElement {
  return (
    <Col align="center" justify="center" gap={8} padding={24}>
      <Text value={title} weight="semibold" textAlign="center" />
    </Col>
  );
}
