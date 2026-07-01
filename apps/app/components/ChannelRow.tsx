
import { memo } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Row, Col, Box } from './layout';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type {
  ChannelLabelChip,
  ChannelTitleSegment,
} from '@stage-labs/views';
import {
  channelRow,
  highlightSegments,
  unreadBadgeLabel,
  CHANNEL_LABEL_PRESS,
} from '@stage-labs/views';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
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

function buildChips(labels: string[]): ChannelLabelChip[] {
  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - visible.length;
  const all = overflow > 0 ? [...visible, `+${overflow}`] : visible;
  return all.map((label) => ({ label }));
}

function titleSegmentsOf(title: string, query?: string): ChannelTitleSegment[] | undefined {
  if (query === undefined || query.trim() === '') return undefined;
  return highlightSegments(title, query.trim()).map((s) => ({
    text: s.value,
    emphasized: s.match,
  }));
}

function resolveDraft(hasDraft?: boolean, draftText?: string | null): string | null {
  return hasDraft && draftText && draftText.trim().length > 0 ? draftText.trim() : null;
}

function resolvePreviewText(draft: string | null, lastPreview?: string | null, subtitle?: string | null): string {
  if (draft) return draft;
  if (lastPreview && lastPreview.length > 0) return lastPreview;
  return subtitle ?? '';
}

function labelChipsOf(draft: string | null, labels?: string[]): ChannelLabelChip[] | undefined {
  if (draft || labels === undefined || labels.length === 0) return undefined;
  return buildChips(labels);
}

function labelRegistry(onLabelPress?: (label: string) => void): WidgetActionRegistry {
  return {
    [CHANNEL_LABEL_PRESS]: (action) => {
      const label = action.payload.label;
      if (onLabelPress && typeof label === 'string') onLabelPress(label);
    },
  };
}

function buildBodyNode(args: {
  title: string; highlightQuery?: string; previewText: string; draft: string | null;
  timestamp?: string | null; pinned?: boolean; chips?: ChannelLabelChip[]; onLabelPress?: (label: string) => void;
}): WidgetRoot {
  return {
    type: 'Basic',
    children: [
      channelRow({
        convId: '',
        avatarUri: '',
        omitAvatar: true,
        interactive: false,
        title: args.title,
        titleSegments: titleSegmentsOf(args.title, args.highlightQuery),
        preview: args.previewText,
        previewPrefix: args.draft ? 'You:' : undefined,
        timestamp: args.timestamp ?? '',
        pinned: args.pinned,
        chips: args.chips,
        labelPressable: !!args.onLabelPress,
      }),
    ],
  };
}

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
  const draft = resolveDraft(hasDraft, draftText);
  const previewText = resolvePreviewText(draft, lastPreview, subtitle);
  const chips = labelChipsOf(draft, labels);
  const node = buildBodyNode({
    title, highlightQuery, previewText, draft, timestamp, pinned, chips, onLabelPress,
  });
  const registry = labelRegistry(onLabelPress);

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
          <KitRenderer node={node} registry={registry} />
        </Col>
        <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
          showChevron={showChevron} head={head} bg={bg} />
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
