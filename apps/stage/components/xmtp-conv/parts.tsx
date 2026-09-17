
import { useEffect, useState } from 'react';

import { Dimensions, StyleSheet, useWindowDimensions } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, pinnedTop } from '../layout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Avatar } from '../Avatar';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { REACT_PRESETS } from '../bubble/MessengerBubble';
import { usePalette } from '../../lib/theme';
import type { HistoryEntry } from '@stage-labs/client/types';
import { menuPlacement, MENU_GAP, MENU_STRIP_HEIGHT } from './menuPlacement';
import { MENU_SHADOW, MENU_WIDTH, MenuSurface, useAnchoredMenus } from '../AnchoredMenu';
import { MenuList, MenuRow } from '../MenuRows';
import { anchoredMenuStyle, type MenuPoint } from '../AnchoredMenu.model';
import { dismissContextMenuProps } from '../../lib/contextMenu';
import type { MenuAnchor } from '../bubble/props';

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
  return (
    <Box style={pinnedTop(2)}>
    <Row height={TOPNAV_HEIGHT + safeTop} surface="toolbar" padding={{ top: safeTop }} align="stretch" style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable
        onPress={onBack}
        style={{ paddingLeft: 14, paddingRight: 8, justifyContent: 'center' }}
>
        <Icon name="arrowNarrowLeft" size={24} color={fg}/>
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

const MORE_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '🤯', '🥳', '👏', '🙌', '🤝', '✅', '❌', '👌', '🚀', '💀', '🤔', '😅', '🫶'];

function ReactionStrip({ expanded, setExpanded, dark, sub, stripBg, border, onReact }: {
  expanded: boolean; setExpanded: (v: boolean) => void; dark: boolean; sub: string;
  stripBg: string; border: string; onReact: (e: string) => void;
}): React.ReactElement {
  const edge = { width: 1, color: border };
  return (
    <Row background={stripBg} radius="full" maxWidth={'100%'} padding={{ x: 10, y: 6 }} align="center" gap={4}
      border={{ top: edge, right: edge, bottom: edge, left: edge }} style={MENU_SHADOW}>
      {expanded ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
          {[...REACT_PRESETS, ...MORE_EMOJIS].map(e => (
            <Pressable key={e} onPress={() => { onReact(e); }} hitSlop={4}><Text size="5xl">{e}</Text></Pressable>
          ))}
        </ScrollView>
      ) : (
        <>
          {REACT_PRESETS.map(e => (
            <Pressable key={e} onPress={() => { onReact(e); }} hitSlop={4} style={{ paddingHorizontal: 2 }}>
              <Text size="5xl">{e}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => { setExpanded(true); }} hitSlop={6}
            style={{
              width: 30, height: 30, borderRadius: 999, marginLeft: 2,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Icon name="chevronDown" size={16} color={sub}/>
          </Pressable>
        </>
      )}
    </Row>
  );
}

interface BubbleActions { reply: () => void; copy: () => void; select: () => void; shareLink: () => void }

function bubbleMenuItems(hasText: boolean): { id: keyof BubbleActions; icon: string; label: string }[] {
  return [
    { id: 'reply', icon: 'reply', label: 'Reply' },
    ...(hasText ? [{ id: 'copy' as const, icon: 'copy', label: 'Copy' }, { id: 'select' as const, icon: 'document', label: 'Select' }] : []),
    { id: 'shareLink', icon: 'send', label: 'Share link' },
  ];
}

function ActionDropdown({ hasText, dark, on }: { hasText: boolean; dark: boolean; on: BubbleActions }): React.ReactElement {
  return (
    <MenuSurface>
      <MenuList dark={dark}>
        {bubbleMenuItems(hasText).map(item => (
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
    <Dialog open={open} onClose={onClose} animationType="none" backdropColor="transparent" fullBleedPanel>
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFillObject}
        {...dismissContextMenuProps(onClose)}
      >
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
          <Box height={MENU_GAP} pointerEvents="none"/>
          {dropdown}
        </Box>
      </Pressable>
    </Dialog>
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
  const [expanded, setExpanded] = useState(false);
  const anchored = useAnchoredMenus();
  useEffect(() => { if (!target) setExpanded(false); }, [target]);

  const pal = usePalette();
  const windowHeight = Dimensions.get('window').height;
  const { stripTop, dropdownAbove } = menuPlacement(anchor.y, !!target?.text, windowHeight);
  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  const dropdown = (
    <ActionDropdown hasText={!!target?.text} dark={dark} on={{ reply: onReply, copy: onCopy, select: onSelect, shareLink: onShareLink }} />
  );
  const strip = (
    <ReactionStrip expanded={expanded} setExpanded={setExpanded} dark={dark} sub={pal.sub} stripBg={pal.inputBg} border={pal.border} onReact={reactAndClose} />
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
          ? { position: 'absolute', left: 12, right: 12, bottom: windowHeight - stripTop + MENU_GAP }
          : { position: 'absolute', left: 12, right: 12, top: stripTop + MENU_STRIP_HEIGHT + MENU_GAP }}
      >
        {dropdownAbove ? dropdown : null}
      </Box>
      <Box align="start" style={{ position: 'absolute', left: 12, right: 12, top: stripTop }} pointerEvents="box-none">
        {strip}
        {dropdownAbove ? null : (
          <>
            <Box height={MENU_GAP} pointerEvents="none"/>
            {dropdown}
          </>
        )}
      </Box>
    </Dialog>
  );
}
