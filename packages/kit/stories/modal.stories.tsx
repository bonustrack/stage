import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Modal, type ModalProps } from '../src/react-native/modal';
import { Button } from '../src/react-native/button';
import { Text } from '../src/react-native/text';
import { bool, color, select, text, useDark } from './_controls';

export default { title: 'Modal' };

type ControlArgs = Pick<ModalProps, 'title' | 'side' | 'backdrop' | 'dismissable' | 'animationType' | 'background' | 'borderColor'>;

export const Controls: Story<ControlArgs> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" label="Open modal" dark={dark} onPress={() => { setOpen(true); }} />
      <Modal {...args} dark={dark} open={open} onClose={() => { setOpen(false); }}>
        <Text text="Modal content goes here." />
      </Modal>
    </>
  );
};
Controls.args = { title: 'New chat', side: 'center', backdrop: true, dismissable: true, animationType: 'none' };
Controls.argTypes = {
  title: text, side: select(['center', 'bottom']), backdrop: bool, dismissable: bool,
  animationType: select(['none', 'fade', 'slide']), background: color, borderColor: color,
};

export const Trigger: Story = () => {
  const dark = useDark();
  return (
    <Modal dark={dark} title="Details" trigger={<Button variant="primary" label="Open with trigger" dark={dark} onPress={() => undefined} />}>
      <Text text="Opened by tapping the trigger." />
    </Modal>
  );
};
