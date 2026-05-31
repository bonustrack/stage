/** Shared presentational row for a channel/conversation card.
 *
 *  Used by BOTH the channels tab (app/(tabs)/index.tsx) and the "Common
 *  channels" section on a peer's profile (CommonChannels.tsx) so the two
 *  surfaces stay visually identical. This component is PRESENTATION ONLY —
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
import { Row, Col, Box } from './layout';
import { usePalette } from '../lib/theme';

export interface ChannelRowProps {
  title: string;
  /** Eth address whose stamp.fyi avatar should render (ignored if avatarUri set). */
  avatarAddress?: string | null;
  /** Custom/group-uploaded image — takes precedence over avatarAddress. */
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
  /** Trailing chevron (used in the boxed common-channels list). */
  showChevron?: boolean;
  avatarSize?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Pressable style override (the channels tab insets the separator itself). */
  containerStyle?: StyleProp<ViewStyle>;
}

/** #6: memoised so a stream tick that re-renders the channels list only
 *  re-renders the rows whose props actually changed (not the whole window).
 *  All props are primitives or stable callbacks (hoisted in the caller). */
function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, showChevron, avatarSize = 40,
  onPress, onLongPress, containerStyle,
}: ChannelRowProps): React.ReactElement {
  const { head, sub, bg, border } = usePalette();
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
      {/* Inner row carries the separator: it starts at the avatar's left edge
          (inset by paddingHorizontal), not the full card width. */}
      <Row align="center" gap={12} py={14} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
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
            <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
              {title}
            </Text>
            {timestamp ? (
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{timestamp}</Text>
            ) : null}
          </Row>
          {/* Reserve the badge's height (22) regardless of whether one shows so
              rows with/without the unread indicator are the same total height. */}
          <Row align="center" gap={8} mt={4} style={{ minHeight: 22 }}>
            <Text style={{ color: sub, fontSize: 16, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
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
