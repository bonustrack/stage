import { Text } from '@stage-labs/kit/react-native/text';
import { Column } from '../layout';

export function EmptyState({ title }: { title: string }): React.ReactElement {
  return (
    <Column align="center" justify="center" gap={8} padding={24}>
      <Text size="xs" text={title} fontWeight="semibold" textAlign="center" />
    </Column>
  );
}
