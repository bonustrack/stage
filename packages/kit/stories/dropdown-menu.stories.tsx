import type { Story } from '../gallery/story';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, type DropdownMenuProps } from '../src/react-native/dropdown-menu';
import { bool, color, number, useDark } from './_controls';

export default { title: 'Dropdown Menu' };

type Args = Pick<DropdownMenuProps, 'background' | 'maxHeight'> & { showDanger: boolean };

export const Controls: Story<Args> = ({ showDanger, ...args }) => {
  const dark = useDark();
  return (
    <DropdownMenu {...args} dark={dark}>
      <DropdownMenuItem dark={dark} iconName="reply" label="Reply" onPress={() => undefined} />
      <DropdownMenuItem dark={dark} iconName="duplicate" label="Copy text" onPress={() => undefined} />
      <DropdownMenuItem dark={dark} iconName="link" label="Share link" onPress={() => undefined} />
      {showDanger ? <DropdownMenuSeparator dark={dark} /> : null}
      {showDanger ? <DropdownMenuItem dark={dark} iconName="trash" label="Delete" danger onPress={() => undefined} /> : null}
    </DropdownMenu>
  );
};
Controls.args = { showDanger: true };
Controls.argTypes = { showDanger: bool, background: color, maxHeight: number };
