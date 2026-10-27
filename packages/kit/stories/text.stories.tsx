import type { Story } from '../gallery/story';
import { Text, type TextProps } from '../src/react-native/text';
import { Column } from '../src/react-native/column';
import { ALIGNS, bool, COLOR_TOKENS, FONT_SIZES, number, select, text } from './_controls';

export default { title: 'Text' };

const VARIANTS = ['body', 'caption'] as const;
const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
const FAMILIES = ['sans', 'head', 'mono'] as const;

export const Controls: Story<TextProps> = (args) => <Text {...args} />;
Controls.args = { text: 'The quick brown fox jumps over the lazy dog', variant: 'body', size: 'md', fontWeight: 'normal', fontFamily: 'sans', textAlign: 'start', italic: false, lineThrough: false, truncate: false, markdown: false };
Controls.argTypes = {
  text, variant: select(VARIANTS), size: select(FONT_SIZES), fontWeight: select(WEIGHTS), fontFamily: select(FAMILIES),
  color: select(COLOR_TOKENS), textAlign: select(ALIGNS), italic: bool, lineThrough: bool, truncate: bool, maxLines: number, markdown: bool, weight: number,
};

export const Matrix: Story = () => (
  <Column gap={12}>
    {FONT_SIZES.map((s) => <Text key={s} size={s}>{s} · Calibre {s}</Text>)}
    {WEIGHTS.map((w) => <Text key={w} fontWeight={w}>fontWeight {w}</Text>)}
    {VARIANTS.map((v) => <Text key={v} variant={v}>variant {v}</Text>)}
    {COLOR_TOKENS.map((c) => <Text key={c} color={c}>color {c}</Text>)}
    <Text fontFamily="mono">fontFamily mono</Text>
  </Column>
);

export const Markdown: Story<{ text: string }> = (args) => <Text markdown text={args.text} />;
Markdown.args = { text: '# Heading\n\nSome **bold**, *italic* and `code` text.\n\n- one\n- two\n\n> A quote' };
Markdown.argTypes = { text };
