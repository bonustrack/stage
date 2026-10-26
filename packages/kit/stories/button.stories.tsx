import type { Story } from '../gallery/story';
import { BUTTON_COLORS as COLORS, BUTTON_FILLS as VARIANTS } from '../src/button.styles';
import { Button, type ButtonProps } from '../src/react-native/button';
import { Icon } from '../src/react-native/icon';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text, useDark } from './_controls';

export default { title: 'Button' };

const HINTS = ['default', 'primary', 'borderless'] as const;
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export const Controls: Story<ButtonProps & { withIconStart: boolean; withIconEnd: boolean }> = ({ withIconStart, withIconEnd, ...args }) => {
  const dark = useDark();
  return (
    <Button
      dark={dark} {...args}
      iconStart={withIconStart ? <Icon name="check" size={16} /> : undefined}
      iconEnd={withIconEnd ? <Icon name="arrowRight" size={16} /> : undefined}
    />
  );
};
Controls.args = { label: 'Button', variant: 'primary', size: 'md', disabled: false, loading: false, block: false, pill: false, uniform: false, withIconStart: false, withIconEnd: false };
Controls.argTypes = {
  label: text, color: select(COLORS), variant: select([...HINTS, ...VARIANTS]), size: select(SIZES), weight: number,
  disabled: bool, loading: bool, block: bool, fullWidth: bool, pill: bool, uniform: bool,
  withIconStart: bool, withIconEnd: bool, radius: number, tintBg: color, tintFg: color, tintPressedBg: color,
};

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={16}>
      {VARIANTS.map((variant) => (
        <Column key={variant} gap={8}>
          <Text size="sm" color="secondary">{variant}</Text>
          <Row gap={8} wrap>
            {COLORS.map((c) => <Button key={c} dark={dark} color={c} variant={variant} label={c} />)}
          </Row>
        </Column>
      ))}
      <Text size="sm" color="secondary">A2UI hints</Text>
      <Row gap={8} wrap>
        {HINTS.map((hint) => <Button key={hint} dark={dark} variant={hint} label={hint} />)}
      </Row>
      <Text size="sm" color="secondary">sizes</Text>
      <Row gap={8} align="center" wrap>
        {SIZES.map((s) => <Button variant="primary" key={s} dark={dark} size={s} label={s} />)}
      </Row>
      <Text size="sm" color="secondary">states</Text>
      <Row gap={8} wrap>
        <Button variant="primary" dark={dark} label="Disabled" disabled />
        <Button variant="primary" dark={dark} label="Failing check" checks={[{ valid: false, message: 'Required' }]} />
        <Button variant="primary" dark={dark} label="Loading" loading />
        <Button variant="primary" dark={dark} label="Pill" pill />
        <Button variant="primary" dark={dark} uniform icon={<Icon name="plus" size={18} />} />
      </Row>
    </Column>
  );
};
