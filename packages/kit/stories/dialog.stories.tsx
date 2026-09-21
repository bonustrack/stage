import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Dialog, type DialogProps } from '../src/react-native/dialog';
import { Button } from '../src/react-native/button';
import { Col } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, useDark } from './_controls';

export default { title: 'Dialog' };

const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;

export const Controls: Story<Omit<DialogProps, 'open' | 'onClose' | 'children'>> = (args) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button dark={dark} label="Open dialog" onPress={() => { setOpen(true); }} />
      <Dialog {...args} open={open} onClose={() => { setOpen(false); }}>
        <Col gap={12} padding={16}>
          <Text weight="semibold" size="lg">Dialog title</Text>
          <Text role="secondary">Every option of the panel is a control on the right.</Text>
          <Button dark={dark} label="Close" onPress={() => { setOpen(false); }} />
        </Col>
      </Dialog>
    </>
  );
};
Controls.args = { side: 'bottom', backdrop: true, dismissable: true, animationType: 'slide', handle: true, scroll: false, safeAreaBottom: true, panelRadius: 'xl', fullBleedPanel: false };
Controls.argTypes = {
  side: select(['center', 'bottom']), backdrop: bool, backdropColor: color, dismissable: bool, animationType: select(['slide', 'fade', 'none']),
  gestureRoot: bool, safeAreaBottom: bool, panelBackground: color, panelRadius: select(RADII), panelMaxHeight: number, panelWidth: number, panelMaxWidth: number, panelPadding: number,
  panelBorderColor: color, handle: bool, handleColor: color, scroll: bool, keyboardPersistTaps: bool, scrollPadding: number, fullBleedPanel: bool,
};
