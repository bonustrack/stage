import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Pressable, type KitPressableProps } from '../src/react-native/pressable';
import { Box } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, number, range } from './_controls';

export default { title: 'Pressable' };

export const Controls: Story<Pick<KitPressableProps, 'pressedOpacity' | 'disabled' | 'hitSlop' | 'delayLongPress'>> = (args) => {
  const [log, setLog] = useState('Press or long-press me');
  return (
    <Pressable {...args} onPress={() => { setLog(`pressed at ${new Date().toLocaleTimeString()}`); }} onLongPress={() => { setLog('long pressed'); }}>
      <Box padding={16} background="#5b8def" radius="md"><Text color="#fff">{log}</Text></Box>
    </Pressable>
  );
};
Controls.args = { pressedOpacity: 0.6, disabled: false, hitSlop: 0, delayLongPress: 500 };
Controls.argTypes = { pressedOpacity: range(0, 1, 0.05), disabled: bool, hitSlop: number, delayLongPress: number };
