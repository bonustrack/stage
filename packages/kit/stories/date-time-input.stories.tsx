import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Column } from '../src/react-native/column';
import { DateTimeInput, type DateTimeInputProps } from '../src/react-native/date-time-input';
import { bool, CONTROL_SIZES, CONTROL_VARIANTS, number, select, text, useDark } from './_controls';

export default { title: 'Date Time Input' };

export const Controls: Story<DateTimeInputProps> = (args) => {
  const [value, setValue] = useState(args.value ?? '');
  return <DateTimeInput {...args} dark={useDark()} value={value} onChange={setValue} />;
};
Controls.args = { label: 'Meeting', enableDate: true, enableTime: false, appearance: 'soft', size: 'md', pill: false, block: false, clearable: true, disabled: false, min: '2026-01-01', max: '2026-12-31' };
Controls.argTypes = {
  label: text, placeholder: text, enableDate: bool, enableTime: bool, appearance: select(CONTROL_VARIANTS), size: select(CONTROL_SIZES),
  pill: bool, block: bool, clearable: bool, disabled: bool, min: text, max: text, radius: number,
};

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={12}>
      <DateTimeInput dark={dark} label="Date" enableDate defaultValue="2026-02-02" />
      <DateTimeInput dark={dark} label="Time" enableTime defaultValue="15:17:00" />
      <DateTimeInput dark={dark} label="Date and time" enableDate enableTime defaultValue="2026-02-02T15:17:00" />
      <DateTimeInput dark={dark} label="Outline" appearance="outline" enableDate />
    </Column>
  );
};
