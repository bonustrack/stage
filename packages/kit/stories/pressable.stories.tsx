import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Pressable, type KitPressableProps } from '../src/react-native/pressable';
import { Text } from '../src/react-native/text';
import { bool, number, range } from './_controls';
import { Column } from '../src/react-native/column';

export default { title: 'Pressable' };

export const Controls: Story<Pick<KitPressableProps, 'pressedOpacity' | 'disabled' | 'hitSlop' | 'delayLongPress'>> = (args) => {
  const [log, setLog] = useState('Press or long-press me');
  return (
    <Pressable
      {...args}
      onPress={() => {
        setLog(`pressed at ${new Date().toLocaleTimeString()}`);
      }}
      onLongPress={() => {
        setLog('long pressed');
      }}
    >
      <Column padding={16} background="#5b8def" radius="md">
        <Text size="xs" color="#fff">
          {log}
        </Text>
      </Column>
    </Pressable>
  );
};
Controls.args = { pressedOpacity: 0.6, disabled: false, hitSlop: 0, delayLongPress: 500 };
Controls.argTypes = { pressedOpacity: range(0, 1, 0.05), disabled: bool, hitSlop: number, delayLongPress: number };
