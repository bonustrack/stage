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
import { Pressable } from 'react-native';
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

/** Compact, read-only label chips shown INLINE on the LEFT of the preview line,
 *  before the last-message text (groups only). Matches the group-info LabelChip
 *  pill style (rounded, bordered) minus the remove affordance, sized down to
 *  fit beside the preview. Caps at MAX_VISIBLE_LABELS + a "+N" pill, and stays
 *  fixed-width so the preview text fills the rest and truncates first. */
function LabelChips({ labels, fg, sub, rowBg, onLabelPress }: {
  labels: string[]; fg: string; sub: string; rowBg: string;
  onLabelPress?: (label: string) => void;
}): React.ReactElement | null {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - visible.length;
  return (
    <Row align="center" gap={4} style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
      {visible.map(label => (
        <Pressable
          key={label.toLowerCase()}
          disabled={!onLabelPress}
          /** Swallow the press so it doesn't bubble to the row's onPress (which
           *  would open the conversation). onPressOut fires after the row's
           *  Pressable would have, so we also gate via the dedicated handler. */
          onPress={onLabelPress ? () => onLabelPress(label) : undefined}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
            backgroundColor: rowBg, flexShrink: 0,
            opacity: pressed && onLabelPress ? 0.6 : 1,
          })}
        >
          <Text style={{ color: fg, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
            {label}
          </Text>
        </Pressable>
      ))}
      {overflow > 0 ? (
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{`+${overflow}`}</Text>
      ) : null}
    </Row>
  );
}

/** #6: memoised so a stream tick that re-renders the channels list only
 *  re-renders the rows whose props actually changed (not the whole window).
 *  All props are primitives or stable callbacks (hoisted in the caller). */
function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, showChevron, avatarSize = 44,
  onPress, onLongPress, containerStyle, labels, onLabelPress,
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
      {/* Inner row: no divider line between rows. */}
      <Row align="center" gap={12} py={9}>
        <Avatar
          imageUri={avatarUri}
          address={!avatarUri && avatarAddress ? avatarAddress : null}
          size={avatarSize}
          square={square}
          cacheBuster={cacheBuster}
          style={{ backgroundColor: border }}
        />
        <Col flex={1} style={{ minWidth: 0 }}>
          <Row align="center" gap={6}>
            {pinned ? <Icon name="mapPin" size={13} color={sub} /> : null}
            {hasDraft ? <Icon name="pencil" size={14} color={sub} /> : null}
            {/* Name + labels hug each other on the left; name shrinks (and
                ellipsizes) first, the label chip stays right beside it. */}
            <Text
              style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', flexShrink: 1, minWidth: 0 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {/* Flexible spacer pushes the timestamp to the far right edge. */}
            <Spacer />
            {timestamp ? (
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{timestamp}</Text>
            ) : null}
          </Row>
          {/* Reserve the badge's height (22) regardless of whether one shows so
              rows with/without the unread indicator are the same total height. */}
          <Row align="center" gap={8} mt={2} style={{ minHeight: 22 }}>
            {/* Labels on the LEFT; preview text fills the rest, truncates first. */}
            {labels && labels.length > 0 ? (
              <LabelChips labels={labels} fg={fg} sub={sub} rowBg={rowBg} onLabelPress={onLabelPress} />
            ) : null}
            <Text style={{ color: sub, fontSize: 17, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={2} ellipsizeMode="tail">
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
