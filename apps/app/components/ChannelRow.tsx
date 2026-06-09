/** Shared presentational row for a channel/conversation card. Used by BOTH the
 *  channels tab (app/(tabs)/index.tsx) and "Common channels" on a peer profile
 *  (CommonChannels.tsx) so the two surfaces stay identical. PRESENTATION ONLY:
 *  all data/state logic lives in the caller and is passed down as props.
 *  Layout: avatar (square for groups/channels, circle for DMs) + a title row
 *  (optional pin/draft glyphs, title, right-aligned timestamp) + a subtitle row
 *  (preview or member count, optional unread badge/dot). Timestamp/preview/
 *  unread props are optional so callers without context can omit them. */

import { memo } from 'react';

// eslint-disable-next-line no-restricted-imports -- raw View is required as an INLINE element inside <Text> (Box/Row/Col carry layout flex and don't embed inline in text flow)
import { View } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
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
  /** Unsent composer draft; with hasDraft it replaces the preview (pencil icon + "You: " text). */
  draftText?: string | null;
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

/** Constant content height on the OUTER row so a 1-line and a 2-line preview
 *  render the SAME total height (title ~23 + 2 * 21 lines ~= 67, also> the 44px
 *  avatar). No internal blank reservation, so the title+preview group centers as
 *  a unit next to the centered avatar. */
const ROW_CONTENT_HEIGHT = 67;

/** Build ROUNDED label chips as INLINE <View>s placed as the FIRST children
 *  INSIDE the preview <Text>; the preview text flows around them. marginRight on
 *  an inline <View> is NOT honored by RN, so the gap comes from a sibling inline
 *  <Text> spacer. Caps at MAX_VISIBLE + a "+N". */
function buildLabelChips({ labels, fg, rowBg }: {
  labels: string[]; fg: string; rowBg: string;
}): React.ReactNode[] {
  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - visible.length;
  const chips = overflow> 0 ? [...visible, `+${overflow}`] : visible;
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
      <Text size="xs" color={fg}>{label}</Text>
    </View>,
    // Real, rendered gap (inline-View margin is NOT honored by RN).
    <Text size="xs" key={`gap-${i}`}>{'  '}</Text>,
  ]);
}

/** #6: memoised so a stream tick that re-renders the channels list only
 *  re-renders the rows whose props actually changed (not the whole window).
 *  All props are primitives or stable callbacks (hoisted in the caller). */
function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, showChevron, avatarSize = 44,
  onPress, onLongPress, containerStyle, labels,
}: ChannelRowProps): React.ReactElement {
  const { link: head, text: sub, bg, border } = usePalette();
  const fg = sub, rowBg = border;
  const draft = hasDraft && draftText && draftText.trim().length> 0 ? draftText.trim() : null;
  const previewText = draft ? `You: ${draft}` : (lastPreview && lastPreview.length> 0 ? lastPreview : subtitle ?? '');

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
      {/* align-center: avatar + text column center as a group within a
          CONSTANT-height row. Fixed height lives on the ROW (ROW_CONTENT_HEIGHT,
          the 2-line case), so 1- and 2-line rows match (no bottom gap). */}
      <Row minHeight={ROW_CONTENT_HEIGHT} padding={{ y: 9 }} align="center" gap={12}>
        <Avatar
          imageUri={avatarUri}
          address={!avatarUri && avatarAddress ? avatarAddress : null}
          size={avatarSize}
          square={square}
          cacheBuster={cacheBuster}
          style={{ backgroundColor: border }}
/>
        <Col minWidth={0} flex={1}>
          <Row align="center" gap={6}>
            {pinned ? <Icon name="mapPin" size={13} color={sub} /> : null}
            {/* Name + labels hug each other on the left; name shrinks (and
                ellipsizes) first, the label chip stays right beside it. */}
            <Text weight="semibold" size="3xl" color={head} style={{ flexShrink: 1, minWidth: 0 }}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
            {/* Flexible spacer pushes the timestamp to the far right edge. */}
            <Spacer/>
            {timestamp ? (
              <Text size="sm" color={sub}>{timestamp}</Text>
            ) : null}
          </Row>
          {/* No internal height reservation: the preview block is only as tall
              as its content (1-2 lines) so the title+preview group centers in the
              fixed-height row. align-start pins the badge to line 1 on wrap. */}
          <Row margin={{ top: 2 }} align="start" gap={7}>
            {/* Draft pencil + "You: " text replaces the preview. Row stays
                align-start (badge on line 1 when preview wraps), so nudge the
                14px glyph down (lineHeight 21 - 14)/2 to center it on line 1. */}
            {draft ? (
              <Box margin={{ top: 3.5 }}>
                <Icon name="pencil" size={14} color={sub}/>
              </Box>
            ) : null}
            <Text size="lg" color={sub} style={{ lineHeight: 21, flex: 1 }}
              numberOfLines={2}
              ellipsizeMode="tail">
              {!draft && labels && labels.length> 0
                ? buildLabelChips({ labels, fg, rowBg })
                : null}
              {previewText}
            </Text>
            {unreadCount> 0 ? (
              <Row minWidth={22} height={22} padding={{ x: 7 }} align="center" justify="center" radius="full" background={head}>
                <Text weight="semibold" size="2xs" color={bg}>
                  {unreadCount> 99 ? '99+' : unreadCount}
                </Text>
              </Row>
            ) : markedUnread ? (
              <Box width={12} height={12} radius="full" background={head}/>
            ) : showChevron ? (
              <Text size="2xl" color={sub}>›</Text>
            ) : null}
          </Row>
        </Col>
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
