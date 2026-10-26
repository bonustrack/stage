import { useState } from 'react';
import type { Story } from '../gallery/story';
import { ChoicePicker, type ChoicePickerProps } from '../src/react-native/choice-picker';
import { Column } from '../src/react-native/column';
import { bool, select, text, useDark } from './_controls';

export default { title: 'Choice Picker' };

const OPTIONS = [
  { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' }, { label: 'SMS', value: 'sms' }, { label: 'Fax', value: 'fax', disabled: true },
];
const VARIANTS = ['mutuallyExclusive', 'multipleSelection'] as const;
const DISPLAY_STYLES = ['checkbox', 'chips'] as const;

export const Controls: Story<ChoicePickerProps> = (args) => {
  const [value, setValue] = useState<string[]>(['email']);
  return <ChoicePicker {...args} dark={useDark()} options={OPTIONS} value={value} onChange={setValue} />;
};
Controls.args = { label: 'Preferred contact', variant: 'mutuallyExclusive', displayStyle: 'checkbox', filterable: false, disabled: false, direction: 'col' };
Controls.argTypes = { label: text, variant: select(VARIANTS), displayStyle: select(DISPLAY_STYLES), filterable: bool, disabled: bool, direction: select(['row', 'col']) };

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={24}>
      {VARIANTS.flatMap((variant) => DISPLAY_STYLES.map((displayStyle) => (
        <ChoicePicker key={`${variant}-${displayStyle}`} dark={dark} label={`${variant} / ${displayStyle}`} options={OPTIONS} variant={variant} displayStyle={displayStyle} defaultValue={['phone']} />
      )))}
    </Column>
  );
};
