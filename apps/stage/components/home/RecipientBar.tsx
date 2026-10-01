import { useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Box, Col, PAGE_GUTTER, Row } from '../layout';
import { MembersPicker } from '../conversation/MemberListSidebar.pickers';
import { includesKey } from '../conversation/SidebarSection.model';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';

const AVATAR_PX = 32;
const RING = 2;
const RING_GAP = 2;
const SLOT_PX = AVATAR_PX + (RING + RING_GAP) * 2;
const PICKER_WIDTH = 300;
const ADD_LABEL = 'Add people';
const PICK_RIGHTS = { add: true, remove: true };

function RecipientAvatar({ address, picked, onToggle }: {
  address: string; picked: boolean; onToggle: (address: string) => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  const name = getPeerName(address) ?? shortAddress(address);
  return (
    <HoverTooltip label={name} placement="above">
      <Pressable
        onPress={() => { onToggle(address); }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: picked }}
        accessibilityLabel={name}
        {...hoverProps}
        style={{
          padding: RING_GAP, borderRadius: SLOT_PX, borderWidth: RING, borderColor: picked ? link : 'transparent',
          opacity: picked || hovered ? 1 : 0.45,
        }}
      >
        <Avatar address={address} size={AVATAR_PX}/>
      </Pressable>
    </HoverTooltip>
  );
}

function AddPeopleButton({ onPress }: { onPress: (event: GestureResponderEvent) => void }): React.ReactElement {
  const { text, link, bg } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={ADD_LABEL} placement="above">
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={ADD_LABEL} {...hoverProps}
        style={{ width: SLOT_PX, height: SLOT_PX, borderRadius: SLOT_PX, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Glyph icon={IconPlusLarge} size={18} color={hovered ? link : text}/>
      </Pressable>
    </HoverTooltip>
  );
}

export function RecipientBar({ shown, picked, onToggle, note }: {
  shown: readonly string[]; picked: readonly string[]; onToggle: (address: string) => void; note: string | null;
}): React.ReactElement {
  const { border } = usePalette();
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Col background={border} padding={{ top: 10 }} gap={6}>
      <Scroll horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Row align="center" gap={6} padding={{ x: PAGE_GUTTER - RING - RING_GAP }}>
          {shown.map(address => (
            <RecipientAvatar key={address} address={address} picked={includesKey(picked, address)} onToggle={onToggle}/>
          ))}
          <AddPeopleButton onPress={(event) => { setAnchor(menuPointAbove(event)); setOpen(true); }}/>
        </Row>
      </Scroll>
      {note === null ? null : (
        <Box padding={{ x: PAGE_GUTTER }}><Text value={note} size="sm" role="secondary"/></Box>
      )}
      {open ? (
        <AnchoredMenu visible onClose={() => { setOpen(false); }} anchor={anchor}>
          <Col width={anchored ? PICKER_WIDTH : undefined}>
            <MembersPicker draft={[...picked]} toggle={onToggle} entries={[]} self="" rights={PICK_RIGHTS}/>
          </Col>
        </AnchoredMenu>
      ) : null}
    </Col>
  );
}
