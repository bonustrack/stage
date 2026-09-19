import type { Story } from '../gallery/story';
import { Text, type TextProps } from '../src/react-native/text';
import { Col } from '../src/react-native/box';
import { ALIGNS, bool, COLOR_TOKENS, FONT_SIZES, number, select, text } from './_controls';

export default { title: 'Text' };

const VARIANTS = ['body', 'secondary', 'caption', 'mono'] as const;
const ROLES = ['default', 'secondary', 'muted', 'link', 'primary', 'danger', 'success'] as const;
const WEIGHTS = ['normal', 'medium', 'semibold', 'bold', 'regular'] as const;

export const Controls: Story<TextProps> = (args) => <Text {...args} />;
Controls.args = { value: 'The quick brown fox jumps over the lazy dog', size: 'md', weight: 'normal', variant: 'body', role: 'default', textAlign: 'start', italic: false, lineThrough: false, truncate: false };
Controls.argTypes = {
  value: text, variant: select(VARIANTS), role: select(ROLES), size: select(FONT_SIZES), weight: select(WEIGHTS),
  color: select(COLOR_TOKENS), textAlign: select(ALIGNS), italic: bool, lineThrough: bool, truncate: bool, maxLines: number,
};

export const Matrix: Story = () => (
  <Col gap={12}>
    {FONT_SIZES.map((s) => <Text key={s} size={s}>{s} · Calibre {s}</Text>)}
    {WEIGHTS.map((w) => <Text key={w} weight={w}>weight {w}</Text>)}
    {VARIANTS.map((v) => <Text key={v} variant={v}>variant {v}</Text>)}
    {ROLES.map((r) => <Text key={r} role={r}>role {r}</Text>)}
  </Col>
);
