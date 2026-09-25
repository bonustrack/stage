import { Fragment, memo } from 'react';

import type { Scheme } from '@stage-labs/kit/tokens';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { BrandIcon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Platform, type TextStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box, PAGE_GUTTER } from './layout';
import { channelRowModel, type ChannelRowParams } from './ChannelRow.model';
import { menuPointOf } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { contextMenuProps } from '../lib/contextMenu';
import { unreadBadgeLabel } from '../lib/format';
import { HIGHLIGHT_BG } from '../lib/uiColors';
import { usePalette } from '../lib/theme';

interface ChannelRowProps {
  title: string;
  avatarAddress?: string | null;
  avatarUri?: string | null;
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
  active?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onLongPress?: (point?: MenuPoint) => void;
  highlightQuery?: string;
  accessory?: React.ReactNode;
}

export const CHANNEL_ROW_HEIGHT = 67;
const BADGE_SIZE = 18;
const TITLE_LINE_HEIGHT = 24;
const PREVIEW_LINE_HEIGHT = 18;
const LINE_GAP = 2;
const PIN_ICON_SIZE = 16;

function TrailingBadge({ unreadCount, markedUnread, head, bg }: {
  unreadCount: number; markedUnread?: boolean; head: string; bg: string;
}): React.ReactElement | null {
  const shown = unreadCount > 0 ? unreadCount : markedUnread === true ? 1 : 0;
  if (shown <= 0) return null;
  return (
    <Row align="center" height={PREVIEW_LINE_HEIGHT}>
      <Row minWidth={BADGE_SIZE} height={BADGE_SIZE} padding={{ x: 4 }} align="center" justify="center" radius="full" background={head}>
        <Text weight="semibold" size="3xs" color={bg}>{unreadBadgeLabel(shown)}</Text>
      </Row>
    </Row>
  );
}

function TitleLine({ params, scheme }: {
  params: ChannelRowParams; scheme: Scheme;
}): React.ReactElement {
  const segments = params.titleSegments && params.titleSegments.length > 0
    ? params.titleSegments
    : [{ text: params.title, emphasized: false }];
  return (
    <Row align="center" gap={4} flex={1} height={TITLE_LINE_HEIGHT}>
      {params.pinned === true ? (
        <Box width={PIN_ICON_SIZE} height={PIN_ICON_SIZE} style={{ flexShrink: 0 }}>
          <BrandIcon name="pin" size={PIN_ICON_SIZE} color={resolveColorToken('secondary', scheme)} dark={scheme === 'dark'} />
        </Box>
      ) : null}
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

function TitleRow({ params, scheme }: {
  params: ChannelRowParams; scheme: Scheme;
}): React.ReactElement {
  return (
    <Row align="center" gap={12} height={TITLE_LINE_HEIGHT}>
      <TitleLine params={params} scheme={scheme} />
      {params.timestamp === '' ? null : <Caption value={params.timestamp} color="secondary" />}
    </Row>
  );
}

const CHIP_TEXT_SIZE = 'sm';
const CHIP_PADDING = { x: 7, y: 3 } as const;
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
    <Text size="md" role="secondary" maxLines={2} style={{ flex: 1, minWidth: 0, lineHeight: PREVIEW_LINE_HEIGHT }}>
      <InlineLabelChips params={params} fg={fg} chipBg={chipBg} />
      {hasPrefix ? <Text value={`${params.previewPrefix ?? ''} `} size="md" color="info" weight="semibold" /> : null}
      {params.preview}
    </Text>
  );
}

function ChannelRowBody({ params, trailing }: {
  params: ChannelRowParams; trailing: React.ReactNode;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg, inputBg } = usePalette();
  const hasPrefix = params.previewPrefix !== undefined && params.previewPrefix !== '';
  return (
    <Col gap={LINE_GAP} flex={1}>
      <TitleRow params={params} scheme={scheme} />
      <Row align="start" gap={12}>
        <PreviewParagraph params={params} fg={fg} chipBg={inputBg} hasPrefix={hasPrefix} />
        {trailing}
      </Row>
    </Col>
  );
}

function ChannelRowBase({
  title, avatarAddress, avatarUri, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, active,
  onPress, onPressIn, onLongPress, labels, highlightQuery, accessory,
}: ChannelRowProps): React.ReactElement {
  const { link: head, bg, border } = usePalette();
  const params = channelRowModel({
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
      style={({ pressed }) => ({
        backgroundColor: pressed || active === true ? border : 'transparent',
        paddingHorizontal: PAGE_GUTTER,
      })}
      {...contextMenuProps(onLongPress)}
>
      <Row minHeight={CHANNEL_ROW_HEIGHT} padding={{ y: 9 }} align="center" gap={12}>
        <Avatar
          imageUri={avatarUri}
          address={avatarUri ? null : avatarAddress ?? null}
          size={44}
          square={square}
          style={{ backgroundColor: border }}
/>
        <Col minWidth={0} flex={1}>
          <ChannelRowBody
            params={params}
            trailing={(
              <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread} head={head} bg={bg} />
            )}
          />
        </Col>
        {accessory}
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
