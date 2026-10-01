import { useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Avatar } from '../Avatar';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Col, PAGE_GUTTER, Row } from '../layout';
import { MembersPicker } from '../conversation/MemberListSidebar.pickers';
import { includesKey } from '../conversation/SidebarSection.model';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';

const AVATAR_PX = 32;
const AVATAR_GAP = 8;
const PICKED_BORDER = 2;
const UNPICKED_OPACITY = 0.4;
const HOVER_OPACITY = 0.7;
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
          borderRadius: AVATAR_PX, outlineStyle: 'solid', outlineWidth: picked ? PICKED_BORDER : 0, outlineColor: link,
          opacity: picked ? 1 : hovered ? HOVER_OPACITY : UNPICKED_OPACITY,
        }}
      >
        <Avatar address={address} size={AVATAR_PX}/>
      </Pressable>
    </HoverTooltip>
  );
}

function AddPeopleButton({ onPress }: { onPress: (event: GestureResponderEvent) => void }): React.ReactElement {
  const { text, link, border } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={ADD_LABEL} placement="above">
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={ADD_LABEL} {...hoverProps}
        style={{ width: AVATAR_PX, height: AVATAR_PX, borderRadius: AVATAR_PX, alignItems: 'center', justifyContent: 'center', backgroundColor: border }}>
        <Glyph icon={IconPlusLarge} size={16} color={hovered ? link : text}/>
      </Pressable>
    </HoverTooltip>
  );
}

export function RecipientBar({ shown, picked, onToggle, onAvatarPress }: {
  shown: readonly string[]; picked: readonly string[]; onToggle: (address: string) => void; onAvatarPress?: () => void;
}): React.ReactElement {
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Col padding={{ bottom: 10 - PICKED_BORDER }}>
      <Scroll horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Row align="center" gap={AVATAR_GAP} padding={{ x: PAGE_GUTTER, y: PICKED_BORDER }}>
          {shown.map(address => (
            <RecipientAvatar key={address} address={address} picked={includesKey(picked, address)}
              onToggle={(a) => { onToggle(a); onAvatarPress?.(); }}/>
          ))}
          <AddPeopleButton onPress={(event) => { setAnchor(menuPointAbove(event)); setOpen(true); }}/>
        </Row>
      </Scroll>
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
