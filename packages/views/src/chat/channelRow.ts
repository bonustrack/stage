import type {
  BadgeColor,
  ListViewItemNode,
  RowNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import {
  CHANNEL_LABEL_PRESS,
  CHANNEL_LONG_PRESS,
  CHANNEL_PRESS,
} from '../actions';
import { badge, caption, col, icon, image, row, text } from '../primitives';

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

function titleNodes(params: ChannelRowParams): WidgetNode[] {
  if (params.titleSegments && params.titleSegments.length > 0) {
    return params.titleSegments.map((segment) =>
      text(segment.text, {
        weight: segment.emphasized ? 'bold' : 'semibold',
        color: segment.emphasized ? 'info' : undefined,
        truncate: true,
      }),
    );
  }
  return [text(params.title, { weight: 'semibold', truncate: true })];
}

function titleRow(params: ChannelRowParams): WidgetNode {
  const nodes: WidgetNode[] = [];
  if (params.pinned === true) nodes.push(icon('map-pin', { size: 'xs', color: 'secondary' }));
  nodes.push(...titleNodes(params));
  return row(nodes, { align: 'center', gap: 4, flex: 1 });
}

function previewNodes(params: ChannelRowParams): WidgetNode[] {
  const nodes: WidgetNode[] = [];
  if (params.previewPrefix !== undefined && params.previewPrefix !== '') {
    nodes.push(caption(params.previewPrefix, { color: 'info', weight: 'semibold' }));
  }
  nodes.push(
    caption(params.preview, { color: 'secondary', truncate: true, maxLines: 1 }),
  );
  return nodes;
}

function chipNodes(params: ChannelRowParams): WidgetNode[] {
  if (params.chips === undefined || params.chips.length === 0) return [];
  return params.chips.map((chip) => {
    const node = badge(chip.label, {
      color: chip.color ?? 'secondary',
      variant: 'soft',
      size: 'sm',
    });
    if (params.labelPressable !== true) return node;
    return {
      type: 'ListViewItem',
      onClickAction: {
        type: CHANNEL_LABEL_PRESS,
        payload: { convId: params.convId, label: chip.label },
      },
      children: [node],
    } satisfies ListViewItemNode;
  });
}

function metaNodes(params: ChannelRowParams): WidgetNode[] {
  const nodes: WidgetNode[] = [caption(params.timestamp, { color: 'secondary' })];
  if (params.unreadBadge !== undefined && params.unreadBadge !== '') {
    nodes.push(badge(params.unreadBadge, { color: 'info', size: 'sm', pill: true }));
  } else if (params.unreadDot === true) {
    nodes.push(badge(' ', { color: 'info', size: 'sm', pill: true }));
  }
  return nodes;
}

export function channelRow(
  params: ChannelRowParams & { interactive?: true },
): ListViewItemNode;
export function channelRow(
  params: ChannelRowParams,
): ListViewItemNode | RowNode;
export function channelRow(params: ChannelRowParams): ListViewItemNode | RowNode {
  const meta = col(metaNodes(params), { gap: 4, align: 'end' });

  const previewRow = row(previewNodes(params), { align: 'center', gap: 4 });
  const chips = chipNodes(params);

  const body = col(
    [
      titleRow(params),
      previewRow,
      ...(chips.length > 0 ? [row(chips, { gap: 4, wrap: 'wrap' })] : []),
    ],
    { gap: 2, flex: 1 },
  );

  const inner = row(
    [
      ...(params.omitAvatar === true
        ? []
        : [image(params.avatarUri, { size: 44, radius: 'full' })]),
      body,
      meta,
    ],
    { align: 'center', gap: 12, flex: 1 },
  );

  if (params.interactive === false) return inner;

  return {
    type: 'ListViewItem',
    onClickAction: {
      type: CHANNEL_PRESS,
      payload: {
        convId: params.convId,
        longPressType: CHANNEL_LONG_PRESS,
        labelPressType: CHANNEL_LABEL_PRESS,
      },
    },
    align: 'center',
    gap: 12,
    children: [inner],
  };
}
