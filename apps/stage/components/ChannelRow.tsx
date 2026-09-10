
import { Fragment, memo } from 'react';

import { resolveBadgeStyle } from '@stage-labs/kit/badge';
import type { Scheme } from '@stage-labs/kit/tokens';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box } from './layout';
import { channelRowModel, type ChannelRowParams } from './ChannelRow.model';
import { menuPointOf } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { contextMenuProps } from '../lib/contextMenu';
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
  showChevron?: boolean;
  active?: boolean;
  avatarSize?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  onLongPress?: (point?: MenuPoint) => void;
  containerStyle?: StyleProp<ViewStyle>;
  noBorder?: boolean;
  highlightQuery?: string;
}

const ROW_CONTENT_HEIGHT = 67;
const BADGE_SIZE = 22;

function TrailingBadge({ unreadCount, markedUnread, showChevron, head, bg }: {
  unreadCount: number; markedUnread?: boolean; showChevron?: boolean;
  head: string; bg: string;
}): React.ReactElement | null {
  const shown = unreadCount > 0 ? unreadCount : markedUnread === true ? 1 : 0;
  if (shown > 0) {
    return (
      <Row minWidth={BADGE_SIZE} height={BADGE_SIZE} padding={{ x: 7 }} align="center" justify="center" radius="full" background={head}>
        <Text weight="semibold" size="2xs" color={bg}>{unreadBadgeLabel(shown)}</Text>
      </Row>
    );
  }
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

const CHIP_TEXT_SIZE = 'sm';
const CHIP_PADDING = { x: 7, y: 1 } as const;
const NATIVE_CHIP_BASELINE_DROP = 4;

function WebChip({ label, fg, chipBg }: {
  label: string; fg: string; chipBg: string;
}): React.ReactElement {
  return (
    <Text
      value={label}
      size={CHIP_TEXT_SIZE}
      color={fg}
      style={[
        {
          backgroundColor: chipBg, borderRadius: 999,
          paddingHorizontal: CHIP_PADDING.x, paddingVertical: CHIP_PADDING.y, userSelect: 'none',
        },
        { whiteSpace: 'nowrap' } as unknown as TextStyle,
      ]}
    />
  );
}

function NativeChip({ label, fg }: {
  label: string; fg: string;
}): React.ReactElement {
  return (
    <Box
      radius="full"
      surface="raised"
      padding={CHIP_PADDING}
      style={{ transform: [{ translateY: NATIVE_CHIP_BASELINE_DROP }] }}
    >
      <Text value={label} size={CHIP_TEXT_SIZE} color={fg} />
    </Box>
  );
}

function InlineLabelChips({ params, fg, chipBg }: {
  params: ChannelRowParams; fg: string; chipBg: string;
}): React.ReactElement | null {
  const chips = params.chips;
  if (chips === undefined || chips.length === 0) return null;
  return (
    <>
      {chips.map((chip, i) => (
        <Fragment key={`${chip.label}-${i}`}>
          {Platform.OS === 'web'
            ? <WebChip label={chip.label} fg={fg} chipBg={chipBg} />
            : <NativeChip label={chip.label} fg={fg} />}
          {' '}
        </Fragment>
      ))}
    </>
  );
}

function PreviewParagraph({ params, fg, chipBg, hasPrefix }: {
  params: ChannelRowParams; fg: string; chipBg: string; hasPrefix: boolean;
}): React.ReactElement {
  return (
    <Text size="md" role="secondary" maxLines={2} style={{ flexShrink: 1 }}>
      <InlineLabelChips params={params} fg={fg} chipBg={chipBg} />
      {hasPrefix ? <Text value={`${params.previewPrefix ?? ''} `} size="md" color="info" weight="semibold" /> : null}
      {params.preview}
    </Text>
  );
}

function ChannelRowBody({ params }: {
  params: ChannelRowParams;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg, inputBg } = usePalette();
  const hasPrefix = params.previewPrefix !== undefined && params.previewPrefix !== '';
  return (
    <Row align="center" gap={12} flex={1}>
      <Col gap={2} flex={1}>
        <TitleLine params={params} scheme={scheme} />
        <PreviewParagraph params={params} fg={fg} chipBg={inputBg} hasPrefix={hasPrefix} />
      </Col>
      <MetaColumn params={params} scheme={scheme} />
    </Row>
  );
}

function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, showChevron, active, avatarSize = 44,
  onPress, onPressIn, onLongPress, containerStyle, labels, highlightQuery,
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
    pinned,
    timestampLabel: timestamp ?? '',
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onLongPress={onLongPress === undefined ? undefined : (e) => { onLongPress(menuPointOf(e)); }}
      delayLongPress={onLongPress ? 300 : undefined}
      style={containerStyle ?? (({ pressed }) => ({
        backgroundColor: pressed || active === true ? border : 'transparent',
        paddingHorizontal: 14,
      }))}
      {...contextMenuProps(onLongPress)}
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
          <ChannelRowBody params={params} />
        </Col>
        <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
          showChevron={showChevron} head={head} bg={bg} />
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
