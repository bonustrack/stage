
import { memo } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box } from './layout';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import {
  basicRoot,
  channelRow,
  channelRowModel,
  unreadBadgeLabel,
  CHANNEL_LABEL_PRESS,
} from '@views';
import { usePalette } from '../lib/theme';

export interface ChannelRowProps {
  title: string;
  avatarAddress?: string | null;
  avatarUri?: string | null;
  cacheBuster?: number | string;
  square?: boolean;
  lastPreview?: string | null;
  timestamp?: string | null;
  subtitle?: string | null;
  unreadCount?: number;
  markedUnread?: boolean;
  pinned?: boolean;
  hasDraft?: boolean;
  draftText?: string | null;
  labels?: string[];
  onLabelPress?: (label: string) => void;
  showChevron?: boolean;
  avatarSize?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  onLongPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  noBorder?: boolean;
  highlightQuery?: string;
}

const ROW_CONTENT_HEIGHT = 67;

function TrailingBadge({ unreadCount, markedUnread, showChevron, head, bg }: {
  unreadCount: number; markedUnread?: boolean; showChevron?: boolean;
  head: string; bg: string;
}): React.ReactElement | null {
  if (unreadCount > 0) {
    return (
      <Row minWidth={22} height={22} padding={{ x: 7 }} align="center" justify="center" radius="full" background={head}>
        <Text weight="semibold" size="2xs" color={bg}>{unreadBadgeLabel(unreadCount)}</Text>
      </Row>
    );
  }
  if (markedUnread) return <Box width={12} height={12} radius="full" background={head}/>;
  if (showChevron) return <Text size="2xl" role="secondary">›</Text>;
  return null;
}

function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, showChevron, avatarSize = 44,
  onPress, onPressIn, onLongPress, containerStyle, labels, onLabelPress, highlightQuery,
}: ChannelRowProps): React.ReactElement {
  const { link: head, bg, border } = usePalette();
  const node = basicRoot(channelRow(channelRowModel({
    convId: '',
    avatarUri: '',
    omitAvatar: true,
    interactive: false,
    title,
    highlightQuery,
    lastPreview,
    subtitle,
    hasDraft,
    draftText,
    labels,
    labelPressable: !!onLabelPress,
    pinned,
    timestampLabel: timestamp ?? '',
  })));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? 300 : undefined}
      style={containerStyle ?? (({ pressed }) => ({
        backgroundColor: pressed ? border : 'transparent',
        paddingHorizontal: 14,
      }))}
>
      <Row minHeight={ROW_CONTENT_HEIGHT} padding={{ y: 9 }} align="center" gap={12}>
        <Avatar
          imageUri={avatarUri}
          address={avatarUri ? null : avatarAddress ?? null}
          size={avatarSize}
          square={square}
          cacheBuster={cacheBuster}
          style={{ backgroundColor: border }}
/>
        <Col minWidth={0} flex={1}>
          <ViewHost
            node={node}
            actions={{
              [CHANNEL_LABEL_PRESS]: (payload) => {
                const label = payload.label;
                if (onLabelPress && typeof label === 'string') onLabelPress(label);
              },
            }}
          />
        </Col>
        <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
          showChevron={showChevron} head={head} bg={bg} />
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
