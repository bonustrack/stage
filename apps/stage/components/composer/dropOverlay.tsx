import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { Row } from '../layout';

export function DropOverlay({ head }: { head: string }): React.ReactElement {
  const edge = { width: 2, color: head, style: 'dashed' };
  return (
    <Row
      pointerEvents="none"
      surface="surface"
      align="center"
      justify="center"
      gap={8}
      radius="lg"
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      style={{ position: 'absolute', top: 6, right: 6, bottom: 6, left: 6 }}
    >
      <Icon name="paperClip" size={20} color={head}/>
      <Text weight="semibold" size="md" color={head}>Drop files to attach</Text>
    </Row>
  );
}
