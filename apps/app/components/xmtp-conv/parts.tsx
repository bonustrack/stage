
import { useEffect, useState } from 'react';

import { Dimensions } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../layout';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Divider } from '@stage-labs/kit/react-native/divider';
import { GithubLogo } from '../GithubLogo';
import { Avatar } from '../Avatar';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { REACT_PRESETS } from '../MessengerBubble';
import { usePalette } from '../../lib/theme';
import type { HistoryEntry } from '@stage-labs/client/types';
import { useBlockRadius } from '../../lib/theme';

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

const MORE_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '🤯', '🥳', '👏', '🙌', '🤝', '✅', '❌', '👌', '🚀', '💀', '🤔', '😅', '🫶'];

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

function clampedMenuTop(anchorY: number, hasText: boolean): number {
  const actionCount = 2 + (hasText ? 2 : 0);
  const unitH = 40 + 6 + (actionCount * 48 + 16);
  const maxTop = Dimensions.get('window').height - 40 - unitH;
  return Math.max(40, Math.min(anchorY, maxTop));
}

export function BubbleActionMenu({
  target, anchor, dark, onClose, onReact, onReply, onCopy, onSelect, onShareLink,
}: {
  target: HistoryEntry | null; anchor: { y: number; height: number };
  dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  onSelect: () => void;
  onShareLink: () => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const blockRadius = useBlockRadius();
  useEffect(() => { if (!target) setExpanded(false); }, [target]);

  const pal = usePalette();
  const stripTop = clampedMenuTop(anchor.y, !!target?.text);
  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      animationType="none"
      backdropColor="rgba(0,0,0,0.45)"
      fullBleedPanel
    >
      <Box align="start" style={{ position: 'absolute', left: 12, right: 12, top: stripTop }} pointerEvents="box-none">
        <ReactionStrip expanded={expanded} setExpanded={setExpanded} dark={dark} sub={pal.sub} stripBg={pal.bg} onReact={reactAndClose} />
        <Box height={6} pointerEvents="none"/>
        <ActionDropdown
          target={target} dark={dark} fg={pal.text} divider={pal.border} cardBg={pal.bg} blockRadius={blockRadius}
          on={{ reply: onReply, copy: onCopy, select: onSelect, shareLink: onShareLink }}
        />
      </Box>
    </Dialog>
  );
}
