import type { Story } from '../gallery/story';
import { BrandIcon, Icon, type BrandIconProps, type IconProps } from '../src/react-native/icon';
import { HERO_ICON_PATHS, type HeroIconName } from '../src/icons';
import { Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, color, range, select, useDark } from './_controls';

export default { title: 'Icon' };

const HERO_NAMES = Object.keys(HERO_ICON_PATHS) as HeroIconName[];
const BRAND_NAMES = ['brandX', 'brandGithub', 'pin', 'brandApple', 'brandAndroid', 'brandWindows', 'brandLinux'] as const;

export const Controls: Story<IconProps> = (args) => <Icon dark={useDark()} {...args} />;
Controls.args = { name: 'chatBubble', size: 32, focused: false };
Controls.argTypes = { name: select(HERO_NAMES), size: range(12, 96, 4), color, focused: bool };

export const Brand: Story<BrandIconProps> = (args) => <BrandIcon dark={useDark()} {...args} />;
Brand.args = { name: 'brandGithub', size: 32 };
Brand.argTypes = { name: select(BRAND_NAMES), size: range(12, 96, 4), color };

export const All: Story = () => {
  const dark = useDark();
  return (
    <Row gap={12} wrap>
      {HERO_NAMES.map((name) => (
        <Col key={name} width={96} align="center" gap={4} padding={{ y: 8 }}>
          <Icon name={name} size={24} dark={dark} />
          <Text size="3xs" role="secondary" truncate>{name}</Text>
        </Col>
      ))}
    </Row>
  );
};
