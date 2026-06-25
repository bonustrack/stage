import type {
  BadgeColor,
  ListViewItemNode,
  RowNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
import {
  CHANNEL_LABEL_PRESS,
  CHANNEL_LONG_PRESS,
  CHANNEL_PRESS,
} from '../actions';

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

interface TitleSeg {
  text: string;
  weight: string;
  background?: string;
}

function titleSegs(params: ChannelRowParams): TitleSeg[] {
  if (params.titleSegments && params.titleSegments.length > 0) {
    return params.titleSegments.map((segment) => ({
      text: segment.text,
      weight: 'semibold',
      background: segment.emphasized === true ? '#FFF200' : undefined,
    }));
  }
  return [{ text: params.title, weight: 'semibold' }];
}

function titleNodes(params: ChannelRowParams): WidgetNode[] {
  const pinned = params.pinned === true;
  return compactList<WidgetNode>([
    pinned
      ? { type: 'Icon', name: 'map-pin', size: 'xs', color: 'secondary' }
      : undefined,
    ...titleSegs(params).map((seg) =>
      compact({
        type: 'Text' as const,
        value: seg.text,
        weight: seg.weight,
        background: seg.background,
        truncate: true,
      }),
    ),
  ]);
}

function previewNodes(params: ChannelRowParams): WidgetNode[] {
  const hasPrefix =
    params.previewPrefix !== undefined && params.previewPrefix !== '';
  return compactList<WidgetNode>([
    hasPrefix
      ? {
          type: 'Caption',
          value: params.previewPrefix ?? '',
          color: 'info',
          weight: 'semibold',
        }
      : undefined,
    {
      type: 'Caption',
      value: params.preview,
      color: 'secondary',
      truncate: true,
      maxLines: 1,
    },
  ]);
}

function chipNodes(params: ChannelRowParams): WidgetNode | undefined {
  if (params.chips === undefined || params.chips.length === 0) return undefined;
  const pressable = params.labelPressable === true;
  const children = params.chips.map((chip): WidgetNode => {
    const color = chip.color ?? 'secondary';
    if (!pressable) {
      return { type: 'Badge', label: chip.label, color, variant: 'soft', size: 'sm' };
    }
    return {
      type: 'ListViewItem',
      onClickAction: {
        type: CHANNEL_LABEL_PRESS,
        payload: { convId: params.convId, label: chip.label },
      },
      children: [
        { type: 'Badge', label: chip.label, color, variant: 'soft', size: 'sm' },
      ],
    };
  });
  return { type: 'Row', gap: 4, wrap: 'wrap', children };
}

function metaNodes(params: ChannelRowParams): WidgetNode[] {
  const hasUnreadBadge =
    params.unreadBadge !== undefined && params.unreadBadge !== '';
  const showUnreadDot = !hasUnreadBadge && params.unreadDot === true;
  return compactList<WidgetNode>([
    { type: 'Caption', value: params.timestamp, color: 'secondary' },
    hasUnreadBadge
      ? {
          type: 'Badge',
          label: params.unreadBadge ?? '',
          color: 'info',
          size: 'sm',
          pill: true,
        }
      : undefined,
    showUnreadDot
      ? { type: 'Badge', label: ' ', color: 'info', size: 'sm', pill: true }
      : undefined,
  ]);
}

function channelBody(params: ChannelRowParams): RowNode {
  const showAvatar = params.omitAvatar !== true;
  const rowChildren = compactList<WidgetNode>([
    showAvatar
      ? { type: 'Image', src: params.avatarUri, size: 44, radius: 'full' }
      : undefined,
    {
      type: 'Col',
      gap: 2,
      flex: 1,
      children: compactList<WidgetNode>([
        { type: 'Row', align: 'center', gap: 4, flex: 1, children: titleNodes(params) },
        { type: 'Row', align: 'center', gap: 4, children: previewNodes(params) },
        chipNodes(params),
      ]),
    },
    { type: 'Col', gap: 4, align: 'end', children: metaNodes(params) },
  ]);
  return { type: 'Row', align: 'center', gap: 12, flex: 1, children: rowChildren };
}

export function channelRow(
  params: ChannelRowParams & { interactive?: true },
): ListViewItemNode;
export function channelRow(params: ChannelRowParams): ListViewItemNode | RowNode;
export function channelRow(params: ChannelRowParams): ListViewItemNode | RowNode {
  const body = channelBody(params);
  if (params.interactive === false) return body;
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
    children: [body],
  };
}
