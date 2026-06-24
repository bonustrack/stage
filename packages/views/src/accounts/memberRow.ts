import type {
  BadgeColor,
  ListViewItemNode,
  WidgetNode,
} from '@stage-labs/kit/chatkit';
import { MEMBER_PRESS, MEMBER_REMOVE } from '../actions';
import { badge, button, caption, col, image, row, text } from '../primitives';

export interface MemberRowParams {
  memberId: string;
  avatarUri: string;
  name: string;
  address?: string;
  roleLabel?: string;
  roleColor?: BadgeColor;
  removable?: boolean;
}

export function memberRow(params: MemberRowParams): ListViewItemNode {
  const lines: WidgetNode[] = [text(params.name, { weight: 'semibold', truncate: true })];
  if (params.address !== undefined && params.address !== '') {
    lines.push(caption(params.address, { color: 'secondary', truncate: true }));
  }
  const body = col(lines, { gap: 2, flex: 1 });

  const trailing: WidgetNode[] = [];
  if (params.roleLabel !== undefined && params.roleLabel !== '') {
    trailing.push(
      badge(params.roleLabel, {
        color: params.roleColor ?? 'discovery',
        variant: 'soft',
        size: 'sm',
        pill: true,
      }),
    );
  }
  if (params.removable === true) {
    trailing.push(
      button({
        iconStart: 'trash',
        color: 'danger',
        variant: 'ghost',
        size: 'sm',
        onClickAction: {
          type: MEMBER_REMOVE,
          payload: { memberId: params.memberId },
        },
      }),
    );
  }

  return {
    type: 'ListViewItem',
    onClickAction: {
      type: MEMBER_PRESS,
      payload: { memberId: params.memberId },
    },
    align: 'center',
    gap: 12,
    children: [
      row(
        [image(params.avatarUri, { size: 40, radius: 'full' }), body, ...trailing],
        { align: 'center', gap: 12, flex: 1 },
      ),
    ],
  };
}
