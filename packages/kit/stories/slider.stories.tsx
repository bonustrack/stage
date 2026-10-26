import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Column } from '../src/react-native/column';
import { Slider, type SliderProps } from '../src/react-native/slider';
import { bool, number, text, useDark } from './_controls';

export default { title: 'Slider' };

export const Controls: Story<SliderProps> = (args) => {
  const [value, setValue] = useState(args.value ?? 40);
  return <Slider {...args} dark={useDark()} value={value} onChange={setValue} />;
};
Controls.args = { label: 'Volume', min: 0, max: 100, steps: 0, disabled: false, showValue: true };
Controls.argTypes = { label: text, min: number, max: number, steps: number, disabled: bool, showValue: bool };

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={16}>
      <Slider dark={dark} label="Continuous" max={1} defaultValue={0.25} />
      <Slider dark={dark} label="Five steps" max={10} steps={5} defaultValue={4} />
      <Slider dark={dark} label="Disabled" max={100} defaultValue={70} disabled />
      <Slider dark={dark} label="Invalid" max={100} defaultValue={5} checks={[{ valid: false, message: 'Pick at least 10.' }]} />
    </Column>
  );
};
