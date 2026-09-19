import type { Story } from '../gallery/story';
import { Label, type LabelProps } from '../src/react-native/label';
import { ALIGNS, color, select, text, useDark } from './_controls';

export default { title: 'Label' };

export const Controls: Story<LabelProps> = (args) => <Label dark={useDark()} {...args} />;
Controls.args = { value: 'Email address', size: 'md', weight: 'medium', textAlign: 'start' };
Controls.argTypes = {
  value: text, fieldName: text, size: select(['xs', 'sm', 'md', 'lg', 'xl']), weight: select(['normal', 'medium', 'semibold', 'bold']),
  textAlign: select(ALIGNS), color,
};
