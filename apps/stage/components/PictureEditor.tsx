import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { AnchoredMenu, menuPointBelow } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { MenuList, MenuRow } from './MenuRows';
import { GroupImagePicker } from './GroupImagePicker';
import { useEffectiveColorScheme } from '../lib/theme';

export type PictureChoice = { kind: 'keep' } | { kind: 'new'; file: PickedFile } | { kind: 'remove' };

export function PictureEditor({ avatar, editable, removable, onChange }: {
  avatar: React.ReactElement; editable: boolean; removable: boolean; onChange: (choice: PictureChoice) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [open, setOpen] = useState(false);
  const [pickNonce, setPickNonce] = useState(0);
  const close = (): void => { setOpen(false); };
  if (!editable) return avatar;
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); setOpen(true); }} hitSlop={8}>{avatar}</Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          <MenuRow icon="camera" label="Upload a picture" dark={dark} onPress={() => { close(); setPickNonce(n => n + 1); }} />
          {removable ? <MenuRow icon="trash" label="Remove picture" danger dark={dark} onPress={() => { close(); onChange({ kind: 'remove' }); }} /> : null}
        </MenuList>
      </AnchoredMenu>
      <GroupImagePicker openNonce={pickNonce} onPick={(file) => { onChange({ kind: 'new', file }); }} />
    </>
  );
}
