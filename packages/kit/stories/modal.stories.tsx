import { useState } from 'react';
import type { Story } from '../gallery/story';
import { MODAL, Modal, Overlay, type ModalProps, type OverlayProps } from '../src/react-native/modal';
import { Column } from '../src/react-native/column';
import { Button } from '../src/react-native/button';
import { Text } from '../src/react-native/text';
import { bool, color, select, text, useDark } from './_controls';
import { MODAL_SIDES } from '../src/kit-vocabulary';

export default { title: 'Modal' };

type ControlArgs = Pick<ModalProps, 'title' | 'side' | 'backdrop' | 'dismissable' | 'animationType' | 'background' | 'borderColor'>;

export const Controls: Story<ControlArgs> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        label="Open modal"
        dark={dark}
        onPress={() => {
          setOpen(true);
        }}
      />
      <Modal
        {...args}
        dark={dark}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <Text text="Modal content goes here." />
      </Modal>
    </>
  );
};
Controls.args = { title: 'New chat', side: 'center', backdrop: true, dismissable: true, animationType: 'none' };
Controls.argTypes = {
  title: text,
  side: select(MODAL_SIDES),
  backdrop: bool,
  dismissable: bool,
  animationType: select(['none', 'fade', 'slide']),
  background: color,
  borderColor: color,
};

export const Trigger: Story = () => {
  const dark = useDark();
  return (
    <Modal
      dark={dark}
      title="Details"
      trigger={<Button variant="primary" label="Open with trigger" dark={dark} onPress={() => undefined} />}
    >
      <Text text="Opened by tapping the trigger." />
    </Modal>
  );
};

type OverlayArgs = Pick<OverlayProps, 'backdrop' | 'backdropColor' | 'dismissable' | 'animationType'>;

export const FullBleedOverlay: Story<OverlayArgs> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="primary"
        label="Open overlay"
        dark={dark}
        onPress={() => {
          setOpen(true);
        }}
      />
      <Overlay {...args} open={open} onClose={close}>
        <Column weight={1} align="center" justify="center" gap={12}>
          <Text text="The overlay fills the window; the host lays out everything in it." />
          <Button label="Close" dark={dark} onPress={close} />
        </Column>
      </Overlay>
    </>
  );
};
FullBleedOverlay.args = { backdrop: true, backdropColor: MODAL.backdrop, dismissable: true, animationType: 'none' };
FullBleedOverlay.argTypes = { backdrop: bool, backdropColor: color, dismissable: bool, animationType: select(['none', 'fade', 'slide']) };
