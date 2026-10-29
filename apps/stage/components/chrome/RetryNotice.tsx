import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Column } from '../layout';

export function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Column align="center" gap={16} padding={24}>
      <Text size="xs" color="secondary" textAlign="center">
        {message}
      </Text>
      <Button dark={dark} variant="soft" label="Try again" style={{ alignSelf: 'center' }} onPress={onRetry} />
    </Column>
  );
}
