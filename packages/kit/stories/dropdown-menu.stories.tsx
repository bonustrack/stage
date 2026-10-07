import { useState } from 'react';
import type { Story } from '../gallery/story';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSheet, type DropdownMenuProps, type DropdownMenuSheetProps } from '../src/react-native/dropdown-menu';
import { Button } from '../src/react-native/button';
import { Badge } from '../src/react-native/badge';
import { Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { DROPDOWN_MENU, useDropdownMenuText } from '../src/react-native/menu';
import { bool, color, number, select, useDark } from './_controls';
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

export const CustomContent: Story = () => {
  const menuText = useDropdownMenuText();
  return (
    <DropdownMenu>
      <DropdownMenuItem label="Sort by: Priority" onPress={() => undefined}>
        <Text {...menuText}>Sort by: <Text {...menuText} role="secondary">Priority</Text></Text>
      </DropdownMenuItem>
      <DropdownMenuItem label="Fields (2)" onPress={() => undefined}>
        <Row align="center" gap={DROPDOWN_MENU.itemGap}>
          <Text {...menuText}>Fields</Text>
          <Badge label="2" color="secondary" variant="soft" pill/>
        </Row>
      </DropdownMenuItem>
    </DropdownMenu>
  );
};

export const Sheet: Story<Pick<DropdownMenuSheetProps, 'side' | 'background' | 'avoidKeyboard'>> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  const close = (): void => { setOpen(false); };
  return (
    <>
      <Button label="Open menu" dark={dark} onPress={() => { setOpen(true); }} />
      <DropdownMenuSheet {...args} dark={dark} open={open} onClose={close}>
        <DropdownMenuItem dark={dark} iconName={IconArrowUndoUp} label="Reply" onPress={close} />
        <DropdownMenuItem dark={dark} iconName={IconSquareBehindSquare2} label="Copy text" onPress={close} />
        <DropdownMenuSeparator dark={dark} />
        <DropdownMenuItem dark={dark} iconName={IconTrashCan} label="Delete" danger onPress={close} />
      </DropdownMenuSheet>
    </>
  );
};
Sheet.args = { side: 'bottom' };
Sheet.argTypes = { side: select(['bottom', 'center']), background: color, avoidKeyboard: bool };
