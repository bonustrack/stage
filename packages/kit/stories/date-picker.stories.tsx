import { useState } from 'react';
import type { Story } from '../gallery/story';
import { DatePicker, type DatePickerProps } from '../src/react-native/date-picker';
import { bool, CONTROL_SIZES, CONTROL_VARIANTS, number, select, text, useDark } from './_controls';

export default { title: 'Date Picker' };

export const Controls: Story<DatePickerProps> = (args) => {
  const [value, setValue] = useState(args.value ?? '');
  return <DatePicker {...args} dark={useDark()} value={value} onChange={setValue} />;
};
Controls.args = { placeholder: 'Pick a date', variant: 'soft', size: 'md', pill: false, block: false, clearable: true, disabled: false, min: '2026-01-01', max: '2026-12-31' };
Controls.argTypes = {
  placeholder: text, variant: select(CONTROL_VARIANTS), size: select(CONTROL_SIZES), pill: bool, block: bool, clearable: bool, disabled: bool,
  min: text, max: text, radius: number,
};
