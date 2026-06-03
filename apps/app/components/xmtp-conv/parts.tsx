/** Presentational sub-components for the XMTP conversation screen — extracted
 *  from app/xmtp/[convId].tsx verbatim (phase-2 lint split). Behavior identical. */

import { useEffect, useState } from 'react';
import { Dimensions, Linking, Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../Avatar';
import { getPeerAvatar } from '../../lib/peerProfiles';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { REACT_PRESETS } from '../MessengerBubble';
import type { HistoryEntry } from '../../lib/types';

/** Topnav GitHub button — opens the group's linked GitHub issue/PR (Linear-style)
 *  externally. Rendered only when a link is set (caller gates on isGroup && url).
 *  Uses the `code` glyph to match the existing GitHubLinkRow convention (the
 *  Heroicons set has no octocat). Sits just before the ⋯ overflow button. */
export function GithubNavButton({ url, color }: { url: string; color: string }): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Linking.openURL(url); }}
      hitSlop={8}
      style={{ paddingHorizontal: 6, justifyContent: 'center' }}
    >
      <Icon name="code" size={22} color={color} />
    </Pressable>
  );
}

/** Topnav avatar — 1-1 conversations use the peer's identicon/custom avatar,
 *  groups show their uploaded image, and groups WITHOUT one fall back to a
 *  deterministic stamp.fyi identicon seeded by the channel id (so every channel
 *  gets its own stable avatar everywhere). Delegates rendering to the shared
 *  Avatar component. */
export function HeaderAvatar({ peerAddr, groupImage, channelId, isGroup, border }: {
  peerAddr: string | null; groupImage: string; channelId: string; isGroup: boolean; border: string;
}): React.ReactElement | null {
  if (peerAddr) {
    return <Avatar address={peerAddr} imageUri={getPeerAvatar(peerAddr)} size="sm" style={{ backgroundColor: border }} />;
  }
  if (groupImage) {
    return <Avatar imageUri={groupImage} size="sm" square style={{ backgroundColor: border }} />;
  }
  if (isGroup && channelId) {
    return <Avatar address={channelStampSeed(channelId)} size="sm" square style={{ backgroundColor: border }} />;
  }
  return null;
}

/** Fuller emoji set revealed by the strip's chevron — a quick scrollable row
 *  beyond the 7 presets. Kept inline (no native emoji-keyboard dependency). */
const MORE_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '🤯', '🥳', '👏', '🙌', '🤝', '✅', '❌', '👌', '🚀', '💀', '🤔', '😅', '🫶'];

/** Telegram-style anchored message menu: a horizontal emoji-reaction pill floating
 *  just above the tapped message, and a vertical action dropdown just below it, over
 *  a dimmed full-screen backdrop. Positioning is driven by the row's measured
 *  on-screen rect (`anchor`), clamped to the screen so it never runs off the top or
 *  bottom edge. Tapping a strip emoji reacts + closes; the chevron reveals more
 *  emojis; any action or an outside tap dismisses. */
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
  useEffect(() => { if (!target) setExpanded(false); }, [target]);

  const fg = dark ? '#e7e7ea' : '#1f2328';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const cardBg = dark ? '#21262b' : '#ffffff';
  const stripBg = dark ? '#21262b' : '#ffffff';
  const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const screenH = Dimensions.get('window').height;
  /** Strip + dropdown are ONE cohesive stacked unit rendered in a single absolute
   *  column: emoji strip on top, a literal GAP-px spacer, then the action dropdown
   *  directly below. Because the dropdown follows the strip's REAL rendered height
   *  in normal flow, the only vertical space between them is exactly GAP — no
   *  hard-coded strip-height estimate. The column is anchored near the tapped
   *  message and clamped so its bottom never runs off-screen past the composer /
   *  safe area (clamp uses an ESTIMATED total height; the strip↔card gap stays
   *  the literal GAP regardless). */
  const actionCount = 2 + (target?.text ? 2 : 0);
  const cardH = actionCount * 48 + 16;       // estimated dropdown height (clamp only)
  const stripH = 40;                          // estimated strip height (clamp only)
  const GAP = 6;                              // literal gap between strip and dropdown
  const TOP_MARGIN = 40;                      // min top inset
  const BOTTOM_MARGIN = 40;                   // keep clear of composer / safe area
  const unitH = stripH + GAP + cardH;         // estimated total height (clamp only)
  /** Anchor the top of the unit near the message top; clamp into screen bounds. */
  const maxTop = screenH - BOTTOM_MARGIN - unitH;
  const stripTop = Math.max(TOP_MARGIN, Math.min(anchor.y, maxTop));

  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  const ActionRow = ({ icon, label, color, onPress }: {
    icon: React.ComponentProps<typeof Icon>['name']; label: string; color?: string; onPress: () => void;
  }): React.ReactElement => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 13, paddingHorizontal: 16,
        backgroundColor: pressed ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
      })}
    >
      <Icon name={icon} size={20} color={color ?? fg} />
      <Text style={{ color: color ?? fg, fontSize: 16, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!target} transparent animationType="none" onRequestClose={onClose}>
      {/** Dimmed full-screen backdrop — tap anywhere outside the cards to dismiss. */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        {/** Strip + dropdown as one absolute column. The dropdown sits directly
          *  below the strip's REAL height + a literal GAP spacer — no stripH math. */}
        <Box
          style={{
            position: 'absolute', left: 12, right: 12, top: stripTop,
            alignItems: 'flex-start',
          }}
          pointerEvents="box-none"
        >
          {/** Emoji reaction strip — rounded pill floating above the message. */}
          <Box style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: stripBg, borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 6,
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
            maxWidth: '100%',
          }}>
            {expanded ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
                {[...REACT_PRESETS, ...MORE_EMOJIS].map(e => (
                  <Pressable key={e} onPress={() => reactAndClose(e)} hitSlop={4}>
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                {REACT_PRESETS.map(e => (
                  <Pressable key={e} onPress={() => reactAndClose(e)} hitSlop={4} style={{ paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setExpanded(true)}
                  hitSlop={6}
                  style={{
                    width: 30, height: 30, borderRadius: 999, marginLeft: 2,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <Icon name="chevronDown" size={16} color={sub} />
                </Pressable>
              </>
            )}
          </Box>

          {/** Literal gap — the ONLY vertical space between strip and dropdown. */}
          <Box style={{ height: GAP }} pointerEvents="none" />

          {/** Action dropdown — rounded card directly below the strip. */}
          <Box
            style={{
              minWidth: 220, maxWidth: 320,
              backgroundColor: cardBg, borderRadius: 14, paddingVertical: 4, overflow: 'hidden',
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
            }}
          >
            <ActionRow icon="reply" label="Reply" onPress={onReply} />
            {target?.text ? <Box style={{ height: 1, backgroundColor: divider, marginLeft: 16 }} /> : null}
            {target?.text ? <ActionRow icon="copy" label="Copy" onPress={onCopy} /> : null}
            {target?.text ? <ActionRow icon="document" label="Select" onPress={onSelect} /> : null}
            <Box style={{ height: 1, backgroundColor: divider, marginLeft: 16 }} />
            <ActionRow icon="send" label="Share link" onPress={onShareLink} />
          </Box>
        </Box>
      </Pressable>
    </Modal>
  );
}
