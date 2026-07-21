
import { memo } from 'react';

import { resolveBadgeStyle } from '@stage-labs/kit/badge';
import type { Scheme } from '@stage-labs/kit/tokens';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box } from './layout';
import { channelRowModel, type ChannelRowParams } from './ChannelRow.model';
import { unreadBadgeLabel } from '../lib/format';
import { HIGHLIGHT_BG } from '../lib/uiColors';
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

function TitleLine({ params, scheme }: {
  params: ChannelRowParams; scheme: Scheme;
}): React.ReactElement {
  const segments = params.titleSegments && params.titleSegments.length > 0
    ? params.titleSegments
    : [{ text: params.title, emphasized: false }];
  return (
    <Row align="center" gap={4} flex={1}>
      {params.pinned === true
        ? <Icon name="mapPin" size={14} color={resolveColorToken('secondary', scheme)} dark={scheme === 'dark'} />
        : null}
      {segments.map((seg, i) => (
        <Text
          key={`${seg.text}-${i}`}
          value={seg.text}
          size="2xl"
          weight="semibold"
          truncate
          style={seg.emphasized === true ? { backgroundColor: HIGHLIGHT_BG[scheme] } : undefined}
        />
      ))}
    </Row>
  );
}

function LabelChips({ params, scheme, fg, onLabelPress }: {
  params: ChannelRowParams; scheme: Scheme; fg: string; onLabelPress?: (label: string) => void;
}): React.ReactElement | null {
  const chips = params.chips;
  if (chips === undefined || chips.length === 0) return null;
  const pressable = params.labelPressable === true && onLabelPress !== undefined;
  return (
    <Row gap={6}>
      {chips.map((chip, i) => {
        const badge = (
          <Box
            key={`${chip.label}-${i}`}
            radius="full"
            surface="raised"
            padding={{ x: 8, y: 2 }}
          >
            <Text value={chip.label} size="md" color={fg} />
          </Box>
        );
        if (!pressable) return badge;
        return (
          <ListViewItem
            key={`${chip.label}-${i}`}
            dark={scheme === 'dark'}
            gap={0}
            padding={{ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 }}
            onPress={() => { onLabelPress(chip.label); }}
          >
            {badge}
          </ListViewItem>
        );
      })}
    </Row>
  );
}

function MetaColumn({ params, scheme }: {
  params: ChannelRowParams; scheme: Scheme;
}): React.ReactElement {
  const hasUnreadBadge = params.unreadBadge !== undefined && params.unreadBadge !== '';
  const showUnreadDot = !hasUnreadBadge && params.unreadDot === true;
  const styled = resolveBadgeStyle('info', undefined, 'sm', scheme);
  return (
    <Col gap={4} align="end">
      <Caption value={params.timestamp} color="secondary" />
      {hasUnreadBadge || showUnreadDot ? (
        <Box direction="row" align="center" padding={{ x: 8, y: 2 }} radius="full" background={styled.background}>
          <Text value={hasUnreadBadge ? params.unreadBadge : ' '} size={styled.fontToken} weight="semibold" color={styled.foreground} />
        </Box>
      ) : null}
    </Col>
  );
}

function ChannelRowBody({ params, onLabelPress }: {
  params: ChannelRowParams; onLabelPress?: (label: string) => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg } = usePalette();
  const hasPrefix = params.previewPrefix !== undefined && params.previewPrefix !== '';
  return (
    <Row align="center" gap={12} flex={1}>
      <Col gap={2} flex={1}>
        <TitleLine params={params} scheme={scheme} />
        <Row align="center" gap={0}>
          <LabelChips params={params} scheme={scheme} fg={fg} onLabelPress={onLabelPress} />
          {hasPrefix ? <Text value={params.previewPrefix ?? ''} size="sm" color="info" weight="semibold" /> : null}
          <Text value={params.preview} size="sm" role="secondary" truncate maxLines={1} style={{ flexShrink: 1 }} />
        </Row>
      </Col>
      <MetaColumn params={params} scheme={scheme} />
    </Row>
  );
}

function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, showChevron, avatarSize = 44,
  onPress, onPressIn, onLongPress, containerStyle, labels, onLabelPress, highlightQuery,
}: ChannelRowProps): React.ReactElement {
  const { link: head, bg, border } = usePalette();
  const params = channelRowModel({
    convId: '',
    avatarUri: '',
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
  });

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
          <ChannelRowBody params={params} onLabelPress={onLabelPress} />
        </Col>
        <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
          showChevron={showChevron} head={head} bg={bg} />
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
