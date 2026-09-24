import type { Story } from '../gallery/story';
import { Tooltip, type TooltipProps } from '../src/react-native/tooltip';
import { color, select, text, useDark } from './_controls';

export default { title: 'Tooltip' };

export const Controls: Story<Pick<TooltipProps, 'label' | 'arrow' | 'background' | 'color'>> = (args) => {
  const dark = useDark();
  return <Tooltip {...args} dark={dark} style={{ alignSelf: 'flex-start' }} />;
};
Controls.args = { label: 'Wallet', arrow: 'down' };
Controls.argTypes = { label: text, arrow: select(['left', 'up', 'down', 'none']), background: color, color };

export const Arrows: Story = () => {
  const dark = useDark();
  return (
    <>
      {(['left', 'up', 'down', 'none'] as const).map(arrow => (
        <Tooltip key={arrow} label={`Arrow ${arrow}`} arrow={arrow} dark={dark} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
      ))}
    </>
  );
};
