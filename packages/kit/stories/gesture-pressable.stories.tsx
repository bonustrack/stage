import { useState } from 'react';
import type { Story } from '../gallery/story';
import { GesturePressable, type GesturePressableProps } from '../src/react-native/gesture-pressable';
import { Box } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { number } from './_controls';

export default { title: 'Gesture Pressable' };

export const Controls: Story<Pick<GesturePressableProps, 'hitSlop'>> = (args) => {
  const [log, setLog] = useState('Tap, long-press or swipe');
  return (
    <GesturePressable
      {...args}
      onPress={(p) => { setLog(`press at ${Math.round(p.x)},${Math.round(p.y)}`); }}
      onLongPress={() => { setLog('long press'); }}
      onSwipe={(dir) => { setLog(`swipe ${dir}`); }}
    >
      <Box padding={32} background="#9b6bd6" radius="md"><Text color="#fff">{log}</Text></Box>
    </GesturePressable>
  );
};
Controls.args = { hitSlop: 0 };
Controls.argTypes = { hitSlop: number };
