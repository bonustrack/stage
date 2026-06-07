/** Shared presentational row for a channel/conversation card.
 *
 *  Used by BOTH the channels tab (app/(tabs)/index.tsx) and the "Common
 *  channels" section on a peer's profile (CommonChannels.tsx) so the two
 *  surfaces stay visually identical. This component is PRESENTATION ONLY -
 *  all data/state logic (unread recount, streaming updates, pin/draft state,
 *  profile-name resolution) lives in the caller, which passes the resolved
 *  values down as props.
 *
 *  Layout: avatar (square for groups/channels, circle for DMs) + a title row
 *  (optional pin/draft glyphs, title, right-aligned timestamp) + a subtitle row
 *  (last-message preview or member count, with an optional unread badge/dot).
 *  Timestamp, preview, and unread props are all optional so callers without
 *  that context (common channels) can omit them gracefully. */

import { memo } from 'react';
// eslint-disable-next-line no-restricted-imports -- raw View is required as an INLINE element inside <Text> (Box/Row/Col carry layout flex and don't embed inline in text flow)
import { Pressable, View } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from '@metro-labs/kit/icon';
import { Spacer } from '@metro-labs/kit/spacer';
import { Row, Col, Box } from './layout';
import { usePalette } from '../lib/theme';

export interface ChannelRowProps {
  title: string;
  /** Eth address whose stamp.fyi avatar should render (ignored if avatarUri set). */
  avatarAddress?: string | null;
  /** Custom/group-uploaded image - takes precedence over avatarAddress. */
  avatarUri?: string | null;
  /** Stamp cache-buster (pass getPeerAvatarCb(avatarAddress)). */
  cacheBuster?: number | string;
  /** Square avatar (groups/channels) vs circle (DMs). */
  square?: boolean;
  /** Subtitle preview text (last message). Mutually exclusive-ish with `subtitle`. */
  lastPreview?: string | null;
  /** Right-aligned timestamp string (already formatted). Omit to hide. */
  timestamp?: string | null;
  /** Explicit subtitle override (e.g. "5 members") when there's no preview. */
  subtitle?: string | null;
  unreadCount?: number;
  /** Force a plain unread dot (cross-device marked-unread, no counted msgs). */
  markedUnread?: boolean;
  pinned?: boolean;
  hasDraft?: boolean;
  /** Group labels (from XMTP appData) rendered as compact read-only chips on
   *  the LEFT of the preview line, before the last-message text (groups only;
   *  DMs pass none). Capped to a few visible + a "+N" pill; the preview text
   *  fills the remaining width and truncates first. */
  labels?: string[];
  /** Tapping a label chip calls this with the chip's label (the caller
   *  navigates to the Channels tab + applies it as the active filter). When
   *  omitted the chips render non-interactive. The press is swallowed so it
   *  never also fires the row's own onPress (opening the conversation). */
  onLabelPress?: (label: string) => void;
  /** Trailing chevron (used in the boxed common-channels list). */
  showChevron?: boolean;
  avatarSize?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Pressable style override (the channels tab insets the separator itself). */
  containerStyle?: StyleProp<ViewStyle>;
  /** No-op: rows no longer render a bottom separator. Kept for caller compat. */
  noBorder?: boolean;
}

/** Max label chips shown inline before collapsing the rest into "+N". Kept low
 *  (2) so the chips stay secondary to the group name on the same row. */
const MAX_VISIBLE_LABELS = 2;

/** Reserved preview height: 2 lines at lineHeight 22 (also clears the 22px
 *  unread badge). Keeps every row a CONSTANT height for 1 or 2 preview lines. */
const PREVIEW_BLOCK = 44;

/** Build ROUNDED label chips as INLINE <View>s placed as the FIRST children
 *  INSIDE the preview <Text>; the preview text flows around them and wraps
 *  UNDERNEATH on the 2nd line. Each chip is a rounded pill (borderRadius 999).
 *  marginRight on an inline <View> is NOT honored by RN, so the visible gap
 *  comes from a sibling inline <Text> spacer. Caps at MAX_VISIBLE + a "+N". */
function buildLabelChips({ labels, fg, rowBg }: {
  labels: string[]; fg: string; rowBg: string;
}): React.ReactNode[] {
  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - visible.length;
  const chips = overflow > 0 ? [...visible, `+${overflow}`] : visible;
  return chips.flatMap((label, i) => [
    <View
      key={`${label.toLowerCase()}-${i}`}
      style={{
        height: 20, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
        backgroundColor: rowBg, justifyContent: 'center',
        // RN aligns an inline <View> by its BOTTOM edge to the text baseline,
        // so a 20px chip sits high vs the fontSize-17/lineHeight-22 preview text.
        // Drop it down so the chip's vertical center matches the text line center.
        transform: [{ translateY: 5 }],
      }}
    >
      <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </View>,
    // Real, rendered gap (inline-View margin is NOT honored by RN).
    <Text key={`gap-${i}`} style={{ fontSize: 13 }}>{'  '}</Text>,
  ]);
}

/** #6: memoised so a stream tick that re-renders the channels list only
 *  re-renders the rows whose props actually changed (not the whole window).
 *  All props are primitives or stable callbacks (hoisted in the caller). */
function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, showChevron, avatarSize = 44,
  onPress, onLongPress, containerStyle, labels,
}: ChannelRowProps): React.ReactElement {
  const { link: head, text: sub, bg, border } = usePalette();
  const fg = sub;
  const rowBg = border;
  const previewText = lastPreview && lastPreview.length > 0 ? lastPreview : subtitle ?? '';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? 300 : undefined}
      style={containerStyle ?? (({ pressed }) => ({
        backgroundColor: pressed ? border : 'transparent',
        paddingHorizontal: 14,
      }))}
    >
      {/* No divider. Top-aligned (align="start"): avatar + text column pin to
          the top of a CONSTANT-height row (reserved 2-line preview block keeps
          every row the same height for 1 vs 2 lines; slack sits at bottom). */}
      <Row align="start" gap={12} py={9}>
        <Avatar
          imageUri={avatarUri}
          address={!avatarUri && avatarAddress ? avatarAddress : null}
          size={avatarSize}
          square={square}
          cacheBuster={cacheBuster}
          style={{ backgroundColor: border }}
        />
        <Col flex={1} style={{ minWidth: 0, marginTop: -4 }}>
          <Row align="center" gap={6}>
            {pinned ? <Icon name="mapPin" size={13} color={sub} /> : null}
            {hasDraft ? <Icon name="pencil" size={14} color={sub} /> : null}
            {/* Name + labels hug each other on the left; name shrinks (and
                ellipsizes) first, the label chip stays right beside it. */}
            <Text
              style={{ color: head, fontSize: 19, fontFamily: 'Calibre-Semibold', flexShrink: 1, minWidth: 0 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {/* Flexible spacer pushes the timestamp to the far right edge. */}
            <Spacer />
            {timestamp ? (
              <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium' }}>{timestamp}</Text>
            ) : null}
          </Row>
          {/* Reserve a FIXED 2-line preview block (PREVIEW_BLOCK = 44, i.e. 2
              lines at lineHeight 22) so a 1-line preview reserves the same
              space as a 2-line one and the row never shrinks. align-start pins
              the unread badge to the FIRST line when the preview wraps. */}
          <Row align="start" gap={7} mt={2} style={{ minHeight: PREVIEW_BLOCK }}>
            {/* ROUNDED chip(s) are INLINE <View>s at the START of the preview
                <Text>, so the preview flows around them and wraps UNDERNEATH the
                chip on the 2nd line (single-line rounded pill, text under it). */}
            <Text
              style={{ color: sub, fontSize: 17, lineHeight: 22, fontFamily: 'Calibre-Medium', flex: 1 }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {labels && labels.length > 0
                ? buildLabelChips({ labels, fg, rowBg })
                : null}
              {previewText}
            </Text>
            {unreadCount > 0 ? (
              <Row align="center" justify="center" px={7} radius={999} bg={head} style={{
                minWidth: 22, height: 22,
              }}>
                <Text style={{ color: bg, fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </Row>
            ) : markedUnread ? (
              <Box style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: head }} />
            ) : showChevron ? (
              <Text style={{ color: sub, fontSize: 18 }}>›</Text>
            ) : null}
          </Row>
        </Col>
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
