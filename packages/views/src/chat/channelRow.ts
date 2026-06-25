import type {
  BadgeColor,
  ListViewItemNode,
  RowNode,
} from '@stage-labs/kit/kit';
import view from './channelRow.json';
import { buildView } from '../buildView';
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

function titleScope(params: ChannelRowParams): Record<string, unknown>[] {
  if (params.titleSegments && params.titleSegments.length > 0) {
    return params.titleSegments.map((segment) => ({
      text: segment.text,
      weight: segment.emphasized ? 'bold' : 'semibold',
      color: segment.emphasized ? 'info' : undefined,
    }));
  }
  return [{ text: params.title, weight: 'semibold' }];
}

function chipScope(params: ChannelRowParams): Record<string, unknown>[] {
  if (params.chips === undefined || params.chips.length === 0) return [];
  const pressable = params.labelPressable === true;
  return params.chips.map((chip) => ({
    label: chip.label,
    color: chip.color ?? 'secondary',
    bare: !pressable || undefined,
    pressable: pressable || undefined,
  }));
}

function flag(value: boolean): true | undefined {
  return value ? true : undefined;
}

function channelFlags(params: ChannelRowParams): Record<string, unknown> {
  const hasUnreadBadge =
    params.unreadBadge !== undefined && params.unreadBadge !== '';
  return {
    showAvatar: flag(params.omitAvatar !== true),
    pinned: flag(params.pinned === true),
    hasPreviewPrefix: flag(
      params.previewPrefix !== undefined && params.previewPrefix !== '',
    ),
    hasChips: flag(params.chips !== undefined && params.chips.length > 0),
    hasUnreadBadge: flag(hasUnreadBadge),
    showUnreadDot: flag(!hasUnreadBadge && params.unreadDot === true),
  };
}

function channelScope(params: ChannelRowParams): Record<string, unknown> {
  return {
    convId: params.convId,
    avatarUri: params.avatarUri,
    preview: params.preview,
    timestamp: params.timestamp,
    pressAction: CHANNEL_PRESS,
    longPressType: CHANNEL_LONG_PRESS,
    labelPressType: CHANNEL_LABEL_PRESS,
    titles: titleScope(params),
    previewPrefix: params.previewPrefix,
    chips: chipScope(params),
    unreadBadge: params.unreadBadge,
    ...channelFlags(params),
  };
}

export function channelRow(
  params: ChannelRowParams & { interactive?: true },
): ListViewItemNode;
export function channelRow(
  params: ChannelRowParams,
): ListViewItemNode | RowNode;
export function channelRow(params: ChannelRowParams): ListViewItemNode | RowNode {
  const built = buildView(view, channelScope(params)) as ListViewItemNode;
  if (params.interactive === false) return built.children[0] as RowNode;
  return built;
}
