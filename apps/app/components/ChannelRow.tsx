
import { memo } from 'react';

import { View } from './layout/native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Spacer } from '@stage-labs/kit/react-native/spacer';
import { Row, Col, Box } from './layout';
import { highlightSegments } from './HighlightText';
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

const MAX_VISIBLE_LABELS = 2;

const ROW_CONTENT_HEIGHT = 67;

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
        transform: [{ translateY: 5 }],
      }}
>
      <Text size="xs" color={fg}>{label}</Text>
    </View>,
    <Text size="xs" key={`gap-${i}`}>{'  '}</Text>,
  ]);
}

function TitleLine({ title, pinned, timestamp, highlightQuery, head, sub }: {
  title: string; pinned?: boolean; timestamp?: string | null;
  highlightQuery?: string; head: string; sub: string;
}): React.ReactElement {
  return (
    <Row align="center" gap={6}>
      {pinned ? <Icon name="mapPin" size={13} color={sub} /> : null}
      {}
      <Text weight="semibold" size="3xl" color={head} style={{ flexShrink: 1, minWidth: 0 }}
        numberOfLines={1}
        ellipsizeMode="tail">
        {highlightQuery ? highlightSegments(title, highlightQuery) : title}
      </Text>
      {}
      <Spacer/>
      {timestamp ? <Text size="sm" role="secondary">{timestamp}</Text> : null}
    </Row>
  );
}

function TrailingBadge({ unreadCount, markedUnread, showChevron, head, bg }: {
  unreadCount: number; markedUnread?: boolean; showChevron?: boolean;
  head: string; bg: string;
}): React.ReactElement | null {
  if (unreadCount> 0) {
    return (
      <Row minWidth={22} height={22} padding={{ x: 7 }} align="center" justify="center" radius="full" background={head}>
        <Text weight="semibold" size="2xs" color={bg}>{unreadCount> 99 ? '99+' : unreadCount}</Text>
      </Row>
    );
  }
  if (markedUnread) return <Box width={12} height={12} radius="full" background={head}/>;
  if (showChevron) return <Text size="2xl" role="secondary">›</Text>;
  return null;
}

function PreviewLine({ draft, labels, previewText, highlightQuery, fg, rowBg, sub }: {
  draft: string | null; labels?: string[]; previewText: string;
  highlightQuery?: string; fg: string; rowBg: string; sub: string;
}): React.ReactElement {
  return (
    <>
      {}
      {draft ? (
        <Box margin={{ top: 3.5 }}>
          <Icon name="pencil" size={14} color={sub}/>
        </Box>
      ) : null}
      <Text size="lg" role="secondary" style={{ lineHeight: 21, flex: 1 }}
        numberOfLines={2}
        ellipsizeMode="tail">
        {!draft && labels && labels.length> 0 ? buildLabelChips({ labels, fg, rowBg }) : null}
        {highlightQuery && !draft ? highlightSegments(previewText, highlightQuery) : previewText}
      </Text>
    </>
  );
}

function resolveDraft(hasDraft?: boolean, draftText?: string | null): string | null {
  return hasDraft && draftText && draftText.trim().length> 0 ? draftText.trim() : null;
}

function resolvePreviewText(draft: string | null, lastPreview?: string | null, subtitle?: string | null): string {
  if (draft) return `You: ${draft}`;
  if (lastPreview && lastPreview.length> 0) return lastPreview;
  return subtitle ?? '';
}

function ChannelRowBase({
  title, avatarAddress, avatarUri, cacheBuster, square,
  lastPreview, timestamp, subtitle, unreadCount = 0, markedUnread,
  pinned, hasDraft, draftText, showChevron, avatarSize = 44,
  onPress, onPressIn, onLongPress, containerStyle, labels, highlightQuery,
}: ChannelRowProps): React.ReactElement {
  const { link: head, text: sub, bg, border } = usePalette();
  const draft = resolveDraft(hasDraft, draftText);
  const previewText = resolvePreviewText(draft, lastPreview, subtitle);

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
      {}
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
          <TitleLine title={title} pinned={pinned} timestamp={timestamp}
            highlightQuery={highlightQuery} head={head} sub={sub} />
          {}
          <Row margin={{ top: 2 }} align="start" gap={7}>
            <PreviewLine draft={draft} labels={labels} previewText={previewText}
              highlightQuery={highlightQuery} fg={sub} rowBg={border} sub={sub} />
            <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
              showChevron={showChevron} head={head} bg={bg} />
          </Row>
        </Col>
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
