import { memo } from 'react';

import type { Scheme } from '@stage-labs/kit/tokens';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import type { TextStyle, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box, PAGE_GUTTER } from './layout';
import { channelRowModel, type ChannelRowParams } from './ChannelRow.model';
import { menuPointOf } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import type { MarkedNode } from './arrowKeys.model';
import { contextMenuProps } from '../lib/contextMenu';
import { HIGHLIGHT_BG } from '../lib/uiColors';
import { usePalette } from '../lib/theme';
import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';
import { titleTone } from './TitleText';
import { UnreadBadge } from './UnreadBadge';
import type { BubbleLinkProps } from './bubble/helpers';

interface ChannelRowProps {
  title: string;
  placeholderTitle?: boolean;
  avatarAddress?: string | null;
  avatarUri?: string | null;
  square?: boolean;
  hideAvatar?: boolean;
  wrapTitle?: boolean;
  lastPreview?: string | null;
  timestamp?: string | null;
  subtitle?: string | null;
  previewLines?: number;
  unreadCount?: number;
  markedUnread?: boolean;
  pinned?: boolean;
  draftText?: string | null;
  labels?: string[];
  active?: boolean;
  onPress?: () => void;
  linkProps?: BubbleLinkProps;
  onPressIn?: () => void;
  onLongPress?: (point?: MenuPoint) => void;
  onContextMenu?: (point: MenuPoint) => void;
  highlightQuery?: string;
  accessory?: React.ReactNode;
  fields?: React.ReactNode;
  mark?: MarkedNode;
}

export const CHANNEL_ROW_HEIGHT = 67;
const TITLE_LINE_HEIGHT = 24;
const WRAPPED_TITLE_LINE_HEIGHT = 22;
const PREVIEW_LINE_HEIGHT = 18;
const LINE_GAP = 2;
const PIN_ICON_SIZE = 16;
const PIN_GAP = 4;

function TrailingBadge({ unreadCount, markedUnread }: {
  unreadCount: number; markedUnread?: boolean;
}): React.ReactElement | null {
  const shown = unreadCount > 0 ? unreadCount : markedUnread === true ? 1 : 0;
  if (shown <= 0) return null;
  return (
    <Row align="center" height={PREVIEW_LINE_HEIGHT}>
      <UnreadBadge count={shown} />
    </Row>
  );
}

function titleLineHeight(wrap: boolean): number {
  return wrap ? WRAPPED_TITLE_LINE_HEIGHT : TITLE_LINE_HEIGHT;
}

function PinGlyph({ scheme }: { scheme: Scheme }): React.ReactElement {
  return <Glyph icon={IconThumbtack} size={PIN_ICON_SIZE} color={resolveColorToken('secondary', scheme)} dark={scheme === 'dark'} />;
}

function WrappedTitle({ texts, pinned, scheme }: {
  texts: React.ReactNode; pinned: boolean; scheme: Scheme;
}): React.ReactElement {
  return (
    <Box flex={1} minWidth={0}>
      <Text size="md" weight="semibold" style={{ lineHeight: WRAPPED_TITLE_LINE_HEIGHT }}>
        {pinned ? <Box width={PIN_ICON_SIZE + PIN_GAP} height={1} /> : null}
        {texts}
      </Text>
      {pinned ? (
        <Row align="center" height={WRAPPED_TITLE_LINE_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
          <PinGlyph scheme={scheme} />
        </Row>
      ) : null}
    </Box>
  );
}

function TitleLine({ params, scheme, wrap }: {
  params: ChannelRowParams; scheme: Scheme; wrap: boolean;
}): React.ReactElement {
  const segments = params.titleSegments && params.titleSegments.length > 0
    ? params.titleSegments
    : [{ text: params.title, emphasized: false }];
  const texts = segments.map((seg, i) => (
    <Text
      key={`${seg.text}-${i}`}
      value={seg.text}
      size="md"
      weight="semibold"
      truncate={!wrap}
      {...titleTone(params.placeholderTitle)}
      style={seg.emphasized === true ? { backgroundColor: HIGHLIGHT_BG[scheme] } : undefined}
    />
  ));
  if (wrap) return <WrappedTitle texts={texts} pinned={params.pinned === true} scheme={scheme} />;
  return (
    <Row align="center" gap={PIN_GAP} flex={1} height={TITLE_LINE_HEIGHT}>
      {params.pinned === true ? (
        <Row align="center" height={TITLE_LINE_HEIGHT} style={{ flexShrink: 0 }}>
          <PinGlyph scheme={scheme} />
        </Row>
      ) : null}
      {texts}
    </Row>
  );
}

function TitleRow({ params, scheme, wrap }: {
  params: ChannelRowParams; scheme: Scheme; wrap: boolean;
}): React.ReactElement {
  return (
    <Row align={wrap ? 'start' : 'center'} gap={12} height={wrap ? undefined : TITLE_LINE_HEIGHT}>
      <TitleLine params={params} scheme={scheme} wrap={wrap} />
      {params.timestamp === '' ? null : (
        <Row align="center" height={titleLineHeight(wrap)}>
          <Caption value={params.timestamp} color="secondary" />
        </Row>
      )}
    </Row>
  );
}

const CHIP_TEXT_SIZE = '2xs';
const CHIP_HEIGHT = 20;
const CHIP_PADDING_X = 7;
const CHIP_GAP = 3;
const CHIP_STYLE: ViewStyle = { flexShrink: 1, minWidth: 0 };
const CHIP_TEXT_STYLE: TextStyle = { lineHeight: CHIP_HEIGHT, flexShrink: 1, userSelect: 'none' };
const CHIP_SPACER_STYLE: ViewStyle = { opacity: 0, overflow: 'hidden' };
const CHIP_OVERLAY_STYLE: ViewStyle = {
  position: 'absolute', top: (PREVIEW_LINE_HEIGHT - CHIP_HEIGHT) / 2, left: 0, maxWidth: '100%', overflow: 'hidden',
};

function PreviewChips({ chips, fg }: {
  chips: NonNullable<ChannelRowParams['chips']>; fg: string;
}): React.ReactElement {
  return (
    <Row gap={CHIP_GAP}>
      {chips.map((chip, i) => (
        <Row
          key={`${chip.label}-${i}`}
          height={CHIP_HEIGHT}
          align="center"
          radius="full"
          surface="raised"
          padding={{ x: CHIP_PADDING_X }}
          style={CHIP_STYLE}
        >
          <Text value={chip.label} size={CHIP_TEXT_SIZE} color={fg} truncate style={CHIP_TEXT_STYLE} />
        </Row>
      ))}
    </Row>
  );
}

function PreviewParagraph({ params, fg, hasPrefix, lines = 2 }: {
  params: ChannelRowParams; fg: string; hasPrefix: boolean; lines?: number;
}): React.ReactElement {
  const chips = params.chips !== undefined && params.chips.length > 0 ? params.chips : null;
  return (
    <Box flex={1} minWidth={0}>
      <Text size="xs" role="secondary" maxLines={lines} style={{ lineHeight: PREVIEW_LINE_HEIGHT }}>
        {chips === null ? null : (
          <Box height={1} padding={{ right: CHIP_GAP }} aria-hidden style={CHIP_SPACER_STYLE}>
            <PreviewChips chips={chips} fg={fg} />
          </Box>
        )}
        {hasPrefix ? <Text value={`${params.previewPrefix ?? ''} `} size="xs" color="danger" /> : null}
        {params.preview}
      </Text>
      {chips === null ? null : (
        <Box style={CHIP_OVERLAY_STYLE}>
          <PreviewChips chips={chips} fg={fg} />
        </Box>
      )}
    </Box>
  );
}

function ChannelRowBody({ params, trailing, wrapTitle, previewLines }: {
  params: ChannelRowParams; trailing: React.ReactNode; wrapTitle: boolean; previewLines?: number;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg } = usePalette();
  const hasPrefix = params.previewPrefix !== undefined && params.previewPrefix !== '';
  return (
    <Col gap={LINE_GAP} flex={1}>
      <TitleRow params={params} scheme={scheme} wrap={wrapTitle} />
      <Row align="start" gap={12}>
        <PreviewParagraph params={params} fg={fg} hasPrefix={hasPrefix} lines={previewLines} />
        {trailing}
      </Row>
    </Col>
  );
}

function ChannelRowBase({
  title, placeholderTitle, avatarAddress, avatarUri, square, hideAvatar, wrapTitle = false,
  lastPreview, timestamp, subtitle, previewLines, unreadCount = 0, markedUnread,
  pinned, draftText, active,
  onPress, linkProps, onPressIn, onLongPress, onContextMenu, labels, highlightQuery, accessory, fields, mark,
}: ChannelRowProps): React.ReactElement {
  const { border } = usePalette();
  const params = channelRowModel({
    title,
    placeholderTitle,
    highlightQuery,
    lastPreview,
    subtitle,
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
      {...linkProps}
      {...contextMenuProps(onContextMenu ?? onLongPress)}
      {...mark}
>
      <Row minHeight={CHANNEL_ROW_HEIGHT} padding={{ y: 9 }} align="center" gap={12}>
        {hideAvatar === true ? null : (
          <Avatar
            imageUri={avatarUri}
            address={avatarUri ? null : avatarAddress ?? null}
            size={44}
            square={square}
            style={{ backgroundColor: border }}
          />
        )}
        <Col minWidth={0} flex={1}>
          <ChannelRowBody
            params={params}
            wrapTitle={wrapTitle}
            previewLines={previewLines}
            trailing={(
              <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread} />
            )}
          />
          {fields}
        </Col>
        {accessory}
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
