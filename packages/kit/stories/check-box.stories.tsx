import { useState } from 'react';
import type { Story } from '../gallery/story';
import { CheckBox, type CheckBoxProps } from '../src/react-native/check-box';
import { Column } from '../src/react-native/column';
import { bool, number, select, text, useDark } from './_controls';

export default { title: 'Check Box' };

const DISPLAY_STYLES = ['checkbox', 'switch'] as const;

export const Controls: Story<CheckBoxProps> = (args) => {
  const [value, setValue] = useState(args.value ?? false);
  return <CheckBox {...args} dark={useDark()} value={value} onChange={setValue} />;
};
Controls.args = { label: 'Accept the terms', value: true, displayStyle: 'checkbox', disabled: false, size: 20 };
Controls.argTypes = { label: text, value: bool, displayStyle: select(DISPLAY_STYLES), disabled: bool, size: number, name: text };

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={12}>
      {DISPLAY_STYLES.flatMap((displayStyle) =>
        [true, false].map((value) => (
          <CheckBox
            key={`${displayStyle}-${String(value)}`}
            dark={dark}
            displayStyle={displayStyle}
            defaultValue={value}
            label={`${displayStyle} ${value ? 'on' : 'off'}`}
          />
        )),
      )}
      <CheckBox dark={dark} label="Required" checks={[{ valid: false, message: 'You must accept the terms.' }]} />
    </Column>
  );
};
