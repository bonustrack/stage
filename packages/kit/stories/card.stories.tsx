import type { Story } from '../gallery/story';
import { Card, type CardProps } from '../src/react-native/card';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text, useDark } from './_controls';

export default { title: 'Card' };

export const Controls: Story<CardProps & { statusText: string; withActions: boolean }> = ({ statusText, withActions, ...args }) => (
  <Card
    {...args} dark={useDark()}
    status={statusText ? { text: statusText } : undefined}
    confirm={withActions ? { label: 'Confirm', onPress: () => undefined } : undefined}
    cancel={withActions ? { label: 'Cancel', onPress: () => undefined } : undefined}
  >
    <Text>Card content goes here. Cards group related content and actions.</Text>
  </Card>
);
Controls.args = { size: 'md', collapsed: false, asForm: false, statusText: 'Status line', withActions: true };
Controls.argTypes = { size: select(['sm', 'md', 'lg']), padding: number, background: color, collapsed: bool, asForm: bool, statusText: text, withActions: bool };
