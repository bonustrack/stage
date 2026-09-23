import type { BadgeColor } from '@stage-labs/kit/badge';
import { highlightSegments } from './HighlightText.model';

interface ChannelLabelChip {
  label: string;
  color?: BadgeColor;
}

interface ChannelTitleSegment {
  text: string;
  emphasized?: boolean;
}

export interface ChannelRowParams {
  title: string;
  preview: string;
  timestamp: string;
  titleSegments?: ChannelTitleSegment[];
  previewPrefix?: string;
  chips?: ChannelLabelChip[];
  pinned?: boolean;
}

const MAX_VISIBLE_LABELS = 2;

interface ChannelRowDomain {
  title: string;
  lastPreview?: string | null;
  subtitle?: string | null;
  timestampLabel: string;
  hasDraft?: boolean;
  draftText?: string | null;
  labels?: string[];
  highlightQuery?: string;
  pinned?: boolean;
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
  return '';
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
    title: d.title,
    titleSegments: resolveTitleSegments(d.title, d.highlightQuery),
    preview: resolvePreview(draft, d),
    previewPrefix: draft ? 'You:' : undefined,
    timestamp: d.timestampLabel,
    chips: resolveChips(draft, d.labels),
    pinned: d.pinned,
  };
}
