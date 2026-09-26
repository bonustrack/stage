import type { Story } from '../gallery/story';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, type DropdownMenuProps } from '../src/react-native/dropdown-menu';
import { bool, color, number, useDark } from './_controls';
import { IconArrowUndoUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUndoUp';
import { IconChainLink3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChainLink3';
import { IconSquareBehindSquare2 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare2';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';

export default { title: 'Dropdown Menu' };

type Args = Pick<DropdownMenuProps, 'background' | 'maxHeight'> & { showDanger: boolean; highlightFirst: boolean };

export const Controls: Story<Args> = ({ showDanger, highlightFirst, ...args }) => {
  const dark = useDark();
  return (
    <DropdownMenu {...args} dark={dark}>
      <DropdownMenuItem dark={dark} iconName={IconArrowUndoUp} label="Reply" highlighted={highlightFirst} onPress={() => undefined} />
      <DropdownMenuItem dark={dark} iconName={IconSquareBehindSquare2} label="Copy text" onPress={() => undefined} />
      <DropdownMenuItem dark={dark} iconName={IconChainLink3} label="Share link" onPress={() => undefined} />
      {showDanger ? <DropdownMenuSeparator dark={dark} /> : null}
      {showDanger ? <DropdownMenuItem dark={dark} iconName={IconTrashCan} label="Delete" danger onPress={() => undefined} /> : null}
    </DropdownMenu>
  );
};
Controls.args = { showDanger: true, highlightFirst: false };
Controls.argTypes = { showDanger: bool, highlightFirst: bool, background: color, maxHeight: number };
