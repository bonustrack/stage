/** @file Shared presentation-only channel/conversation row (avatar + title with pin/draft glyphs, timestamp, preview/member-count subtitle), used by the channels tab and a peer profile's "Common channels". */

import { memo } from 'react';

/** Raw View (via the sanctioned layout/native escape hatch) needed as an INLINE element inside <Text>, which Box/Row/Col can't be. */
import { View } from './layout/native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import type { StyleProp, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from '@metro-labs/kit/icon';
import { Spacer } from '@metro-labs/kit/spacer';
import { Row, Col, Box } from './layout';
import { highlightSegments } from './HighlightText';
import { usePalette } from '../lib/theme';

export interface ChannelRowProps {
  title: string;
  /** Eth address whose stamp.fyi avatar should render (ignored if avatarUri set). */
  avatarAddress?: string | null;
  /** Custom/group-uploaded image - takes precedence over avatarAddress. */
  avatarUri?: string | null;
  /** Optional stamp cache-buster to force a refetch. */
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
  /** Group labels (XMTP appData) as compact read-only chips left of the preview text (groups only), capped to a few visible + a "+N" pill; the preview fills remaining width and truncates first. */
  labels?: string[];
  /** Tapping a label chip calls this with the chip's label (caller applies it as the active Channels filter); omitting it makes chips non-interactive, and the press is swallowed so it never fires the row's own onPress. */
  onLabelPress?: (label: string) => void;
  /** Trailing chevron (used in the boxed common-channels list). */
  showChevron?: boolean;
  avatarSize?: number;
  onPress?: () => void;
  /** Fires on touch-down (before onPress) - used to warm the feed cache the instant a row is touched so the conversation opens from cache. */
  onPressIn?: () => void;
  onLongPress?: () => void;
  /** Pressable style override (the channels tab insets the separator itself). */
  containerStyle?: StyleProp<ViewStyle>;
  /** No-op: rows no longer render a bottom separator. Kept for caller compat. */
  noBorder?: boolean;
  /** Active search query — when set, its case-insensitive occurrences in the title and last-message preview are highlighted (fluo yellow), matching the in-conversation search highlight. Empty/absent leaves text untouched. */
  highlightQuery?: string;
}

/** Max label chips shown inline before collapsing the rest into "+N". Kept low (2) so the chips stay secondary to the group name on the same row. */
const MAX_VISIBLE_LABELS = 2;

/** Constant outer-row content height so 1-line and 2-line previews render the same total height (title ~23 + 2 * 21 ~= 67, also > the 44px avatar) and the title+preview group centers as a unit next to the avatar. */
const ROW_CONTENT_HEIGHT = 67;

/** Builds rounded label chips as inline <View>s placed first inside the preview <Text> (text flows around them); the gap is a sibling inline <Text> spacer since inline-View marginRight isn't honored by RN. Caps at MAX_VISIBLE + a "+N". */
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
        /** RN aligns an inline <View> by its bottom edge to the text baseline, so drop the 20px chip down to center it against the fontSize-17/lineHeight-22 preview text. */
        transform: [{ translateY: 5 }],
      }}
>
      <Text size="xs" color={fg}>{label}</Text>
    </View>,
    /** Real, rendered gap (inline-View margin is NOT honored by RN). */
    <Text size="xs" key={`gap-${i}`}>{'  '}</Text>,
  ]);
}

/** Renders the title + pin glyph + right-aligned timestamp line of a channel row. */
function TitleLine({ title, pinned, timestamp, highlightQuery, head, sub }: {
  title: string; pinned?: boolean; timestamp?: string | null;
  highlightQuery?: string; head: string; sub: string;
}): React.ReactElement {
  return (
    <Row align="center" gap={6}>
      {pinned ? <Icon name="mapPin" size={13} color={sub} /> : null}
      {/** Name + labels hug each other on the left; the name shrinks/ellipsizes first and the label chip stays beside it. */}
      <Text weight="semibold" size="3xl" color={head} style={{ flexShrink: 1, minWidth: 0 }}
        numberOfLines={1}
        ellipsizeMode="tail">
        {highlightQuery ? highlightSegments(title, highlightQuery) : title}
      </Text>
      {/** Flexible spacer pushes the timestamp to the far right edge. */}
      <Spacer/>
      {timestamp ? <Text size="sm" color={sub}>{timestamp}</Text> : null}
    </Row>
  );
}

/** Renders the trailing unread count pill, marked-unread dot, or chevron of a channel row. */
function TrailingBadge({ unreadCount, markedUnread, showChevron, head, bg, sub }: {
  unreadCount: number; markedUnread?: boolean; showChevron?: boolean;
  head: string; bg: string; sub: string;
}): React.ReactElement | null {
  if (unreadCount> 0) {
    return (
      <Row minWidth={22} height={22} padding={{ x: 7 }} align="center" justify="center" radius="full" background={head}>
        <Text weight="semibold" size="2xs" color={bg}>{unreadCount> 99 ? '99+' : unreadCount}</Text>
      </Row>
    );
  }
  if (markedUnread) return <Box width={12} height={12} radius="full" background={head}/>;
  if (showChevron) return <Text size="2xl" color={sub}>›</Text>;
  return null;
}

/** Renders the preview/draft line (label chips + last-message text) of a channel row. */
function PreviewLine({ draft, labels, previewText, highlightQuery, fg, rowBg, sub }: {
  draft: string | null; labels?: string[]; previewText: string;
  highlightQuery?: string; fg: string; rowBg: string; sub: string;
}): React.ReactElement {
  return (
    <>
      {/** Draft pencil + "You: " text replaces the preview. */}
      {draft ? (
        <Box margin={{ top: 3.5 }}>
          <Icon name="pencil" size={14} color={sub}/>
        </Box>
      ) : null}
      <Text size="lg" color={sub} style={{ lineHeight: 21, flex: 1 }}
        numberOfLines={2}
        ellipsizeMode="tail">
        {!draft && labels && labels.length> 0 ? buildLabelChips({ labels, fg, rowBg }) : null}
        {highlightQuery && !draft ? highlightSegments(previewText, highlightQuery) : previewText}
      </Text>
    </>
  );
}

/** Resolve the trimmed draft text (or null) for a channel row. */
function resolveDraft(hasDraft?: boolean, draftText?: string | null): string | null {
  return hasDraft && draftText && draftText.trim().length> 0 ? draftText.trim() : null;
}

/** Resolve the preview text shown on a channel row (draft, last message, or subtitle). */
function resolvePreviewText(draft: string | null, lastPreview?: string | null, subtitle?: string | null): string {
  if (draft) return `You: ${draft}`;
  if (lastPreview && lastPreview.length> 0) return lastPreview;
  return subtitle ?? '';
}

/** #6: memoised so a stream tick that re-renders the channels list only re-renders the rows whose props actually changed (not the whole window). All props are primitives or stable callbacks (hoisted in the caller). */
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
      {/** align-center: avatar + text column center as a group within a constant-height row. */}
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
          {/** No internal height reservation; align-start pins the badge to line 1 on wrap. */}
          <Row margin={{ top: 2 }} align="start" gap={7}>
            <PreviewLine draft={draft} labels={labels} previewText={previewText}
              highlightQuery={highlightQuery} fg={sub} rowBg={border} sub={sub} />
            <TrailingBadge unreadCount={unreadCount} markedUnread={markedUnread}
              showChevron={showChevron} head={head} bg={bg} sub={sub} />
          </Row>
        </Col>
      </Row>
    </Pressable>
  );
}

export const ChannelRow = memo(ChannelRowBase);
