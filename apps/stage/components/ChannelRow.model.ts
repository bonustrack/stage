import type { FontSizeName } from '@stage-labs/kit/tokens';
import { withChannelLabels } from '@stage-labs/client/xmtp/channelRefs';
import { highlightSegments } from './HighlightText.model';

interface ChannelTitleSegment {
  text: string;
  emphasized?: boolean;
}

export interface ChannelRowParams {
  title: string;
  placeholderTitle?: boolean;
  preview: string;
  showPreview: boolean;
  timestamp: string;
  timestampSize: FontSizeName;
  titleSegments?: ChannelTitleSegment[];
  previewPrefix?: string;
  pinned?: boolean;
}

interface ChannelRowDomain {
  title: string;
  placeholderTitle?: boolean;
  lastPreview?: string | null;
  subtitle?: string | null;
  timestampLabel: string;
  draftText?: string | null;
  showPreview?: boolean;
  highlightQuery?: string;
  pinned?: boolean;
}

function resolveDraft(draftText?: string | null): string | null {
  return draftText && draftText.trim().length > 0 ? withChannelLabels(draftText.trim()) : null;
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
  const draft = resolveDraft(d.draftText);
  return {
    title: d.title,
    placeholderTitle: d.placeholderTitle,
    titleSegments: resolveTitleSegments(d.title, d.highlightQuery),
    preview: resolvePreview(draft, d),
    showPreview: d.showPreview !== false,
    previewPrefix: draft ? 'Draft:' : undefined,
    timestamp: d.timestampLabel,
    timestampSize: '3xs',
    pinned: d.pinned,
  };
}
