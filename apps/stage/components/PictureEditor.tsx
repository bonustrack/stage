import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { AnchoredMenu, menuPointBelow } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { MenuRow } from './MenuRows';
import { SquareImagePicker } from './SquareImagePicker';
import { usePastedPicture } from './composer/pastedImages';
import { IconCamera1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCamera1';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';

export type PictureChoice = { kind: 'keep' } | { kind: 'new'; file: PickedFile } | { kind: 'remove' };

export function PictureEditor({ avatar, editable, removable, onChange }: {
  avatar: React.ReactElement; editable: boolean; removable: boolean; onChange: (choice: PictureChoice) => void;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [open, setOpen] = useState(false);
  const [pickNonce, setPickNonce] = useState(0);
  const close = (): void => { setOpen(false); };
  usePastedPicture(editable, (file) => { onChange({ kind: 'new', file }); });
  if (!editable) return avatar;
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); setOpen(true); }} hitSlop={8}>{avatar}</Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <MenuRow icon={IconCamera1} label="Upload a picture" onPress={() => { close(); setPickNonce(n => n + 1); }} />
        {removable ? <MenuRow icon={IconTrashCan} label="Remove picture" danger onPress={() => { close(); onChange({ kind: 'remove' }); }} /> : null}
      </AnchoredMenu>
      <SquareImagePicker openNonce={pickNonce} onPick={(file) => { onChange({ kind: 'new', file }); }} />
    </>
  );
}
