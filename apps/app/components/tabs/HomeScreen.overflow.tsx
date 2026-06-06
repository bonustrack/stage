/** HomeScreen overflow menu - the Home topnav 3-dot (kebab) button + the
 *  bottom-sheet it opens. Declutters the topnav by folding the former
 *  Archived + New-group icons into a single overflow menu, presented as the
 *  app's standard AppModal sheet (same surface + MenuRow pattern as the
 *  per-conversation ChannelMenu). The requests icon stays in the topnav. */

import { useState } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Col } from '../layout';
import { AppModal } from '../AppModal';

interface HomeOverflowMenuProps {
  /** Topnav glyph color (matches the sibling requests icon). */
  color: string;
  /** Open the dedicated Archived channels view (former archive icon action). */
  onArchived: () => void;
  /** Start the new-group flow (former "+" icon action). */
  onNewGroup: () => void;
}

/** Topnav kebab button + its overflow sheet. Owns its own open/close state so
 *  the list view only passes the two actions. */
export function HomeOverflowMenu({ color, onArchived, onNewGroup }: HomeOverflowMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);
  const run = (fn: () => void): void => { close(); fn(); };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AppModal visible={open} onClose={close}>
        <Col gap={4}>
          <OverflowRow icon="archive" label="Archived" color={color} onPress={() => run(onArchived)} />
          <OverflowRow icon="plus" label="New group" color={color} onPress={() => run(onNewGroup)} />
        </Col>
      </AppModal>
    </>
  );
}

function OverflowRow({ icon, label, color, onPress }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  color: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <Icon name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: 18, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </Pressable>
  );
}
