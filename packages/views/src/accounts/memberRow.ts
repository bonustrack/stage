import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { MEMBER_PRESS, MEMBER_REMOVE } from '../actions';

export type MemberBadgeRole = 'owner' | 'admin';

interface MemberBadge {
  label: string;
  background: string;
  color: string;
}

export interface MemberRowParams {
  memberId: string;
  avatarUri: string;
  name: string;
  address?: string;
  role?: MemberBadgeRole;
  removable?: boolean;
  dark: boolean;
  borderColor: string;
  subColor: string;
  dangerColor: string;
  removePressedBg: string;
}

function memberBadge(params: MemberRowParams): MemberBadge | undefined {
  if (params.role === 'owner') {
    return {
      label: 'Owner',
      background: params.dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)',
      color: params.dark ? '#2dd4bf' : '#0d9488',
    };
  }
  if (params.role === 'admin') {
    return { label: 'Admin', background: params.borderColor, color: params.subColor };
  }
  return undefined;
}

export function memberRow(params: MemberRowParams): ListViewItemNode {
  const hasAddress = params.address !== undefined && params.address !== '';
  const badge = memberBadge(params);
  const colChildren = compactList<WidgetNode>([
    { type: 'Text', value: params.name, weight: 'semibold', truncate: true },
    hasAddress
      ? {
          type: 'Caption',
          value: params.address ?? '',
          color: 'secondary',
          truncate: true,
        }
      : undefined,
  ]);
  const rowChildren = compactList<WidgetNode>([
    {
      type: 'Image',
      src: params.avatarUri,
      size: 40,
      radius: 'full',
      background: params.borderColor,
    },
    { type: 'Col', gap: 2, flex: 1, children: colChildren },
    badge !== undefined
      ? {
          type: 'Badge',
          label: badge.label,
          background: badge.background,
          color: badge.color,
          variant: 'soft',
          size: '3xs',
          weight: 'medium',
          pill: true,
        }
      : undefined,
    params.removable === true
      ? {
          type: 'Button',
          iconStart: 'trash',
          variant: 'ghost',
          uniform: true,
          size: 'xs',
          radius: 'full',
          foreground: params.dangerColor,
          pressedBackground: params.removePressedBg,
          onClickAction: {
            type: MEMBER_REMOVE,
            payload: { memberId: params.memberId },
          },
        }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: { type: MEMBER_PRESS, payload: { memberId: params.memberId } },
    align: 'center',
    gap: 12,
    padding: { x: 14, y: 14 },
    pressedBackground: params.borderColor,
    border: { bottom: { size: 1, color: params.borderColor } },
    children: [{ type: 'Row', align: 'center', gap: 12, flex: 1, children: rowChildren }],
  };
}
