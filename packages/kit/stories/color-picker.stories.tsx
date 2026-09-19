import { useState } from 'react';
import type { Story } from '../gallery/story';
import { ColorPicker, type ColorPickerProps } from '../src/react-native/color-picker';
import { Col } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { color, select, useDark } from './_controls';

export default { title: 'Color Picker' };

export const Controls: Story<ColorPickerProps> = (args) => {
  const [value, setValue] = useState(args.value);
  return (
    <Col gap={12}>
      <ColorPicker {...args} dark={useDark()} value={value} onChange={setValue} />
      <Text role="secondary" size="sm">value: {value}</Text>
    </Col>
  );
};
Controls.args = { value: '#5b8def', mode: 'swatches' };
Controls.argTypes = { mode: select(['swatches', 'hsv']), headColor: color, subColor: color, borderColor: color, rowBg: color };
