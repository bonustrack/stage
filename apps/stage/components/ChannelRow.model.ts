import type { BadgeColor } from '@stage-labs/kit/badge';
import { channelTimestamp, unreadBadgeLabel } from '../lib/format';
import { highlightSegments } from './HighlightText.model';

export interface ChannelLabelChip {
  label: string;
  color?: BadgeColor;
}

export interface ChannelTitleSegment {
  text: string;
  emphasized?: boolean;
}

export interface ChannelRowParams {
  convId: string;
  avatarUri: string;
  title: string;
  preview: string;
  timestamp: string;
  unreadBadge?: string;
  titleSegments?: ChannelTitleSegment[];
  previewPrefix?: string;
  chips?: ChannelLabelChip[];
  pinned?: boolean;
  unreadDot?: boolean;
  omitAvatar?: boolean;
  labelPressable?: boolean;
  interactive?: boolean;
}

const MAX_VISIBLE_LABELS = 2;

export interface ChannelRowDomain {
  convId: string;
  title: string;
  avatarUri: string;
  lastPreview?: string | null;
  subtitle?: string | null;
  lastTs?: number | null;
  timestampLabel?: string;
  hasDraft?: boolean;
  draftText?: string | null;
  labels?: string[];
  labelPressable?: boolean;
  highlightQuery?: string;
  pinned?: boolean;
  unreadCount?: number;
  markedUnread?: boolean;
  emptyPreview?: string;
  omitAvatar?: boolean;
  interactive?: boolean;
}

function resolveDraft(hasDraft?: boolean, draftText?: string | null): string | null {
  return hasDraft && draftText && draftText.trim().length > 0 ? draftText.trim() : null;
}

function resolvePreview(
  draft: string | null,
  d: ChannelRowDomain,
): string {
  if (draft) return draft;
  if (d.lastPreview && d.lastPreview.length > 0) return d.lastPreview;
  if (d.subtitle && d.subtitle.length > 0) return d.subtitle;
  return d.emptyPreview ?? '';
}

function resolveChips(
  draft: string | null,
  labels?: string[],
): ChannelLabelChip[] | undefined {
  if (draft || labels === undefined || labels.length === 0) return undefined;
  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - visible.length;
  const all = overflow > 0 ? [...visible, `+${overflow}`] : visible;
  return all.map((label) => ({ label }));
}

function resolveTitleSegments(
  title: string,
  query?: string,
): ChannelTitleSegment[] | undefined {
  if (query === undefined || query.trim() === '') return undefined;
  return highlightSegments(title, query.trim()).map((s) => ({
    text: s.value,
    emphasized: s.match,
  }));
}

export function channelRowModel(d: ChannelRowDomain): ChannelRowParams {
  const draft = resolveDraft(d.hasDraft, d.draftText);
  return {
    convId: d.convId,
    avatarUri: d.avatarUri,
    title: d.title,
    titleSegments: resolveTitleSegments(d.title, d.highlightQuery),
    preview: resolvePreview(draft, d),
    previewPrefix: draft ? 'You:' : undefined,
    timestamp: d.timestampLabel ?? channelTimestamp(d.lastTs ?? null),
    unreadBadge: unreadBadgeLabel(d.unreadCount ?? 0, d.markedUnread ?? false),
    chips: resolveChips(draft, d.labels),
    pinned: d.pinned,
    labelPressable: d.labelPressable,
    omitAvatar: d.omitAvatar,
    interactive: d.interactive,
  };
}
