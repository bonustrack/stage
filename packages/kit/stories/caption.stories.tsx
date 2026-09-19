import type { Story } from '../gallery/story';
import { Caption, type CaptionProps } from '../src/react-native/caption';
import { ALIGNS, bool, COLOR_TOKENS, number, select, text } from './_controls';

export default { title: 'Caption' };

export const Controls: Story<CaptionProps> = (args) => <Caption {...args} />;
Controls.args = { value: 'A caption under some content', size: 'md', weight: 'normal', textAlign: 'start', truncate: false };
Controls.argTypes = {
  value: text, size: select(['sm', 'md']), weight: select(['normal', 'medium', 'semibold']), textAlign: select(ALIGNS),
  color: select(COLOR_TOKENS), truncate: bool, maxLines: number,
};
