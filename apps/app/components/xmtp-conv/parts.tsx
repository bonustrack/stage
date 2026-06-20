/** @file Presentational sub-components for the XMTP conversation screen — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). Behavior identical. */

import { useEffect, useState } from 'react';

import { Dimensions, Modal } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useRouter } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Divider } from '@metro-labs/kit/divider';
import { GithubLogo } from '../GithubLogo';
import { Avatar } from '../Avatar';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { REACT_PRESETS } from '../MessengerBubble';
import { usePalette } from '../../lib/theme';
import type { HistoryEntry } from '../../lib/types';
import { useBlockRadius } from '../../lib/theme';

/** Topnav GitHub button — opens the in-app PR diff viewer for the linked PR/issue. */
export function GithubNavButton({ url, color }: { url: string; color: string }): React.ReactElement {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => { router.push({ pathname: '/diff', params: { url } }); }}
      hitSlop={8}
      style={{ paddingHorizontal: 6, justifyContent: 'center' }}
>
      <GithubLogo size={20} color={color}/>
    </Pressable>
  );
}

/** Topnav avatar — peer identicon/custom avatar for 1-1s, uploaded image for groups, and a deterministic channel-id-seeded stamp.fyi identicon for groups without one, delegating rendering to the shared Avatar component. */
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

/** Fuller emoji set revealed by the strip's chevron — a quick scrollable row beyond the 7 presets. Kept inline (no native emoji-keyboard dependency). */
const MORE_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '🤯', '🥳', '👏', '🙌', '🤝', '✅', '❌', '👌', '🚀', '💀', '🤔', '😅', '🫶'];

/** A single tappable row in the action dropdown (icon + label). */
function ActionRow({ icon, label, color, fg, dark, onPress }: {
  icon: React.ComponentProps<typeof Icon>['name']; label: string; color?: string;
  fg: string; dark: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 13, paddingHorizontal: 16,
        backgroundColor: pressed ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
      })}
    >
      <Icon name={icon} size={20} color={color ?? fg}/>
      <Text size="md" color={color ?? fg}>{label}</Text>
    </Pressable>
  );
}

/** Emoji reaction strip: the 7 presets + a chevron that expands to the fuller set. */
function ReactionStrip({ expanded, setExpanded, dark, sub, stripBg, onReact }: {
  expanded: boolean; setExpanded: (v: boolean) => void; dark: boolean; sub: string;
  stripBg: string; onReact: (e: string) => void;
}): React.ReactElement {
  return (
    <Row background={stripBg} radius="full" maxWidth={'100%'} padding={{ x: 10, y: 6 }} align="center" gap={4} style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
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

/** Action dropdown card: Reply, (Copy / Select for text), and Share link. */
function ActionDropdown({ target, dark, fg, divider, cardBg, blockRadius, on }: {
  target: HistoryEntry | null; dark: boolean; fg: string; divider: string; cardBg: string;
  blockRadius: number; on: { reply: () => void; copy: () => void; select: () => void; shareLink: () => void };
}): React.ReactElement {
  const hasText = !!target?.text;
  return (
    <Box minWidth={220} maxWidth={320} background={cardBg} radius={blockRadius} padding={{ y: 4 }}
      style={{ overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
      <ActionRow icon="reply" label="Reply" fg={fg} dark={dark} onPress={on.reply}/>
      {hasText ? <Divider dark={dark} color={divider} style={{ marginLeft: 16 }} /> : null}
      {hasText ? <ActionRow icon="copy" label="Copy" fg={fg} dark={dark} onPress={on.copy} /> : null}
      {hasText ? <Divider dark={dark} color={divider} style={{ marginLeft: 16 }} /> : null}
      {hasText ? <ActionRow icon="document" label="Select" fg={fg} dark={dark} onPress={on.select} /> : null}
      <Divider dark={dark} color={divider} style={{ marginLeft: 16 }}/>
      <ActionRow icon="send" label="Share link" fg={fg} dark={dark} onPress={on.shareLink}/>
    </Box>
  );
}

/** Clamp the menu's top so the estimated strip+dropdown unit stays within the screen. */
function clampedMenuTop(anchorY: number, hasText: boolean): number {
  const actionCount = 2 + (hasText ? 2 : 0);
  const unitH = 40 + 6 + (actionCount * 48 + 16); /** stripH + GAP + estimated cardH (clamp only) */
  const maxTop = Dimensions.get('window').height - 40 - unitH;
  return Math.max(40, Math.min(anchorY, maxTop));
}

/** Telegram-style anchored message menu: emoji-reaction strip above the tapped message + an action dropdown below, clamped on-screen. */
export function BubbleActionMenu({
  target, anchor, dark, onClose, onReact, onReply, onCopy, onSelect, onShareLink,
}: {
  target: HistoryEntry | null; anchor: { y: number; height: number };
  dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  /** Enable OS text selection on the target message for partial copy. */
  onSelect: () => void;
  onShareLink: () => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const blockRadius = useBlockRadius();
  useEffect(() => { if (!target) setExpanded(false); }, [target]);

  const pal = usePalette();
  const stripTop = clampedMenuTop(anchor.y, !!target?.text);
  /** React And Close. */
  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  return (
    <Modal visible={!!target} transparent animationType="none" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        {/* Strip + a literal 6px gap + dropdown, as one absolute column. */}
        <Box align="start" style={{ position: 'absolute', left: 12, right: 12, top: stripTop }} pointerEvents="box-none">
          <ReactionStrip expanded={expanded} setExpanded={setExpanded} dark={dark} sub={pal.sub} stripBg={pal.bg} onReact={reactAndClose} />
          <Box height={6} pointerEvents="none"/>
          <ActionDropdown
            target={target} dark={dark} fg={pal.text} divider={pal.border} cardBg={pal.bg} blockRadius={blockRadius}
            on={{ reply: onReply, copy: onCopy, select: onSelect, shareLink: onShareLink }}
          />
        </Box>
      </Pressable>
    </Modal>
  );
}
