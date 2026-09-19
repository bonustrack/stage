import type { Story } from '../gallery/story';
import { Badge, type BadgeProps } from '../src/react-native/badge';
import { Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, select, text, useDark } from './_controls';

export default { title: 'Badge' };

const COLORS = ['secondary', 'success', 'danger', 'warning', 'info', 'discovery'] as const;
const VARIANTS = ['solid', 'soft', 'outline'] as const;
const SIZES = ['3xs', '2xs', 'sm', 'md', 'lg'] as const;

export const Controls: Story<BadgeProps> = (args) => <Badge dark={useDark()} {...args} />;
Controls.args = { label: 'Badge', color: 'secondary', variant: 'solid', size: 'md', pill: false };
Controls.argTypes = { label: text, color: select(COLORS), variant: select(VARIANTS), size: select(SIZES), pill: bool };

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Col gap={12}>
      {VARIANTS.map((variant) => (
        <Row key={variant} gap={8} align="center" wrap>
          <Text size="sm" role="secondary">{variant}</Text>
          {COLORS.map((c) => <Badge key={c} dark={dark} color={c} variant={variant} label={c} />)}
        </Row>
      ))}
      <Row gap={8} align="center" wrap>
        {SIZES.map((s) => <Badge key={s} dark={dark} size={s} label={s} />)}
        <Badge dark={dark} label="pill" pill />
      </Row>
    </Col>
  );
};
