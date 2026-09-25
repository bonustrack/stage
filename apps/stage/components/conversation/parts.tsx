import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, pinnedTop, PAGE_GUTTER } from '../layout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Avatar } from '../Avatar';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { REACT_PRESETS } from '../bubble/helpers';
import { usePalette } from '../../lib/theme';
import type { HistoryEntry } from '@stage-labs/client/types';
import { menuPlacement, STRIP_GAP, MENU_STRIP_HEIGHT } from './menuPlacement';
import { bubbleMenuItems } from './bubbleMenu.model';
import { AnchoredOverlay, MENU_SHADOW, MENU_WIDTH, MenuSurface, useAnchoredMenus } from '../AnchoredMenu';
import { MenuList, MenuRow } from '../MenuRows';
import { anchoredMenuStyle, type MenuPoint } from '../AnchoredMenu.model';
import type { MenuAnchor } from '../bubble/props';
import { useHover } from '../hover';

export function HeaderAvatar({ peerAddr, groupImage, channelId, isGroup, border }: {
  peerAddr: string | null; groupImage: string; channelId: string; isGroup: boolean; border: string;
}): React.ReactElement | null {
  if (peerAddr) {
    return <Avatar address={peerAddr} size="sm" style={{ backgroundColor: border }} />;
  }
  if (groupImage) {
    return <Avatar imageUri={groupImage} size="sm" square style={{ backgroundColor: border }} />;
  }
  if (isGroup && channelId) {
    return <Avatar address={channelStampSeed(channelId)} size="sm" square style={{ backgroundColor: border }} />;
  }
  return null;
}

export function ConvTopnavShell({ fg, border, safeTop, onBack, children }: {
  fg: string; border: string; safeTop: number; onBack: () => void; children: React.ReactNode;
}): React.ReactElement {
  const { link } = usePalette();
  const back = useHover();
  return (
    <Box style={pinnedTop(2)}>
    <Row height={TOPNAV_HEIGHT + safeTop} surface="toolbar" padding={{ top: safeTop }} align="stretch" style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable
        onPress={onBack}
        {...back.hoverProps}
        style={{ paddingLeft: PAGE_GUTTER, paddingRight: 8, justifyContent: 'center' }}
>
        <Icon name="arrowNarrowLeft" size={24} color={back.hovered ? link : fg}/>
      </Pressable>
      {children}
    </Row>
    </Box>
  );
}

export function ConvTopnavIdentity({ peerAddr, groupImage, channelId, isGroup, border, head, title, onPress }: {
  peerAddr: string | null; groupImage: string; channelId: string; isGroup: boolean;
  border: string; head: string; title: string; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
>
      <HeaderAvatar peerAddr={peerAddr} groupImage={groupImage} channelId={channelId} isGroup={isGroup} border={border}/>
      <Text weight="semibold" size="4xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

function ReactionStrip({ stripBg, onReact }: {
  stripBg: string; onReact: (e: string) => void;
}): React.ReactElement {
  return (
    <Row background={stripBg} radius="full" padding={{ x: 10, y: 6 }} align="center" gap={4} style={{ alignSelf: 'flex-start', ...MENU_SHADOW }}>
      {REACT_PRESETS.map(e => (
        <Pressable key={e} onPress={() => { onReact(e); }} hitSlop={4} style={{ paddingHorizontal: 2 }}>
          <Text size="5xl">{e}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

interface BubbleActions { reply: () => void; copy: () => void; select: () => void; shareLink: () => void }

const SELECT_TEXT = Platform.OS !== 'web';

function ActionDropdown({ hasText, dark, on }: { hasText: boolean; dark: boolean; on: BubbleActions }): React.ReactElement {
  return (
    <MenuSurface>
      <MenuList dark={dark}>
        {bubbleMenuItems(hasText, { selectText: SELECT_TEXT }).map(item => (
          <MenuRow key={item.id} icon={item.icon} label={item.label} dark={dark} onPress={on[item.id]} />
        ))}
      </MenuList>
    </MenuSurface>
  );
}

function AnchoredBubbleMenu({ open, point, onClose, strip, dropdown }: {
  open: boolean; point: MenuPoint; onClose: () => void;
  strip: React.ReactNode; dropdown: React.ReactNode;
}): React.ReactElement {
  const viewport = useWindowDimensions();
  const placement = anchoredMenuStyle(point, viewport);
  return (
    <AnchoredOverlay open={open} onClose={onClose}>
      <Box
        width={MENU_WIDTH}
        align="start"
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: placement.top, bottom: placement.bottom,
          left: placement.left, right: placement.right,
        }}
      >
        {strip}
        <Box height={STRIP_GAP} pointerEvents="none"/>
        {dropdown}
      </Box>
    </AnchoredOverlay>
  );
}

export function BubbleActionMenu({
  target, anchor, dark, onClose, onReact, onReply, onCopy, onSelect, onShareLink,
}: {
  target: HistoryEntry | null; anchor: MenuAnchor;
  dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  onSelect: () => void;
  onShareLink: () => void;
}): React.ReactElement {
  const anchored = useAnchoredMenus();

  const pal = usePalette();
  const windowHeight = Dimensions.get('window').height;
  const { stripTop, dropdownAbove } = menuPlacement(anchor.y, !!target?.text, windowHeight);
  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  const dropdown = (
    <ActionDropdown hasText={!!target?.text} dark={dark} on={{ reply: onReply, copy: onCopy, select: onSelect, shareLink: onShareLink }} />
  );
  const strip = (
    <ReactionStrip stripBg={pal.border} onReact={reactAndClose} />
  );

  if (anchored && anchor.point) {
    return (
      <AnchoredBubbleMenu
        open={!!target} point={anchor.point} onClose={onClose} strip={strip} dropdown={dropdown}
      />
    );
  }

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      animationType="none"
      backdropColor="rgba(0,0,0,0.45)"
      fullBleedPanel
    >
      <Box
        align="start" pointerEvents="box-none"
        style={dropdownAbove
          ? { position: 'absolute', left: 12, right: 12, bottom: windowHeight - stripTop + STRIP_GAP }
          : { position: 'absolute', left: 12, right: 12, top: stripTop + MENU_STRIP_HEIGHT + STRIP_GAP }}
      >
        {dropdownAbove ? dropdown : null}
      </Box>
      <Box align="start" style={{ position: 'absolute', left: 12, right: 12, top: stripTop }} pointerEvents="box-none">
        {strip}
        {dropdownAbove ? null : (
          <>
            <Box height={STRIP_GAP} pointerEvents="none"/>
            {dropdown}
          </>
        )}
      </Box>
    </Dialog>
  );
}
