import type { Story } from '../gallery/story';
import { Col, Row } from '../src/react-native/box';
import { Spinner, type SpinnerProps } from '../src/react-native/spinner';
import { Text } from '../src/react-native/text';
import { useKitPalette } from '../src/react-native/theme-context';
import { color, range } from './_controls';

export default { title: 'Spinner' };

const SIZES = [16, 20, 24, 28, 36] as const;
const ROLES = ['text', 'sub', 'link', 'primary', 'danger', 'success'] as const;

export const Controls: Story<SpinnerProps> = (args) => <Spinner {...args} />;
Controls.args = { size: 28 };
Controls.argTypes = { size: range(12, 96, 4), color };

export const Matrix: Story = () => {
  const palette = useKitPalette();
  return (
    <Col gap={16}>
      <Row gap={16} align="center" wrap>
        {SIZES.map((size) => (
          <Col key={size} gap={6} align="center">
            <Spinner size={size} />
            <Text size="xs" role="secondary">{size}</Text>
          </Col>
        ))}
      </Row>
      <Row gap={16} align="center" wrap>
        {ROLES.map((role) => (
          <Col key={role} gap={6} align="center">
            <Spinner color={palette[role]} />
            <Text size="xs" role="secondary">{role}</Text>
          </Col>
        ))}
      </Row>
    </Col>
  );
};
