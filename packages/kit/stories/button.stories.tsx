import type { Story } from '../gallery/story';
import { Button, type ButtonProps } from '../src/react-native/button';
import { Icon } from '../src/react-native/icon';
import { Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text, useDark } from './_controls';

export default { title: 'Button' };

const COLORS = ['primary', 'secondary', 'info', 'discovery', 'success', 'caution', 'warning', 'danger'] as const;
const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const;
const SIZES = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;

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
Controls.args = { label: 'Button', color: 'primary', variant: 'solid', size: 'md', disabled: false, loading: false, block: false, pill: false, uniform: false, withIconStart: false, withIconEnd: false };
Controls.argTypes = {
  label: text, color: select(COLORS), variant: select(VARIANTS), size: select(SIZES),
  disabled: bool, loading: bool, block: bool, fullWidth: bool, pill: bool, uniform: bool,
  withIconStart: bool, withIconEnd: bool, radius: number, tintBg: color, tintFg: color, tintPressedBg: color,
};

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Col gap={16}>
      {VARIANTS.map((variant) => (
        <Col key={variant} gap={8}>
          <Text size="sm" role="secondary">{variant}</Text>
          <Row gap={8} wrap>
            {COLORS.map((c) => <Button key={c} dark={dark} color={c} variant={variant} label={c} />)}
          </Row>
        </Col>
      ))}
      <Text size="sm" role="secondary">sizes</Text>
      <Row gap={8} align="center" wrap>
        {SIZES.map((s) => <Button key={s} dark={dark} size={s} label={s} />)}
      </Row>
      <Text size="sm" role="secondary">states</Text>
      <Row gap={8} wrap>
        <Button dark={dark} label="Disabled" disabled />
        <Button dark={dark} label="Loading" loading />
        <Button dark={dark} label="Pill" pill />
        <Button dark={dark} uniform icon={<Icon name="plus" size={18} />} />
      </Row>
    </Col>
  );
};
