import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Modal, type ModalProps } from '../src/react-native/modal';
import { Button } from '../src/react-native/button';
import { Text } from '../src/react-native/text';
import { bool, select, text, useDark } from './_controls';

export default { title: 'Modal' };

export const Controls: Story<Pick<ModalProps, 'title' | 'side' | 'dismissable'>> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Open modal" dark={dark} onPress={() => { setOpen(true); }} />
      <Modal {...args} dark={dark} open={open} onClose={() => { setOpen(false); }}>
        <Text size="sm" value="Modal content goes here." />
      </Modal>
    </>
  );
};
Controls.args = { title: 'New chat', side: 'center', dismissable: true };
Controls.argTypes = { title: text, side: select(['center', 'bottom']), dismissable: bool };
