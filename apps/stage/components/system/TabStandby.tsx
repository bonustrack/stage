import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { useEffectiveColorScheme } from '../../lib/theme';
import { takeOverTab } from '../../lib/tabLock';
import { Column, PAGE_GUTTER, viewportFill } from '../layout';

export function TabStandby(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Column surface="surface" align="center" justify="center" gap={16} padding={{ x: PAGE_GUTTER }} style={viewportFill()}>
      <Column align="center" gap={8}>
        <Text text="Stage is open in another tab" fontWeight="semibold" size="md" textAlign="center" />
        <Text
          size="xs"
          color="secondary"
          textAlign="center"
          text="Stage runs in one tab at a time. Click Use here to use it in this tab."
        />
      </Column>
      <Button
        label="Use here"
        size="lg"
        pill
        color="primary"
        variant="solid"
        dark={dark}
        style={{ alignSelf: 'center' }}
        onPress={takeOverTab}
      />
    </Column>
  );
}
