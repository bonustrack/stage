import type { Story } from '../gallery/story';
import { BADGE_COLORS as COLORS, BADGE_SIZES as SIZES, BADGE_VARIANTS as VARIANTS } from '../src/badge';
import { Badge, type BadgeProps } from '../src/react-native/badge';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { bool, select, text, useDark } from './_controls';

export default { title: 'Badge' };

export const Controls: Story<BadgeProps> = (args) => <Badge dark={useDark()} {...args} />;
Controls.args = { label: 'Badge', color: 'secondary', variant: 'solid', size: 'md', pill: false };
Controls.argTypes = { label: text, color: select(COLORS), variant: select(VARIANTS), size: select(SIZES), pill: bool };

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={12}>
      {VARIANTS.map((variant) => (
        <Row key={variant} gap={8} align="center" wrap>
          <Text size="sm" color="secondary">
            {variant}
          </Text>
          {COLORS.map((c) => (
            <Badge key={c} dark={dark} color={c} variant={variant} label={c} />
          ))}
        </Row>
      ))}
      <Row gap={8} align="center" wrap>
        {SIZES.map((s) => (
          <Badge key={s} dark={dark} size={s} label={s} />
        ))}
        <Badge dark={dark} label="pill" pill />
      </Row>
    </Column>
  );
};
