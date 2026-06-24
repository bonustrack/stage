import type { ListViewItemNode } from '@stage-labs/kit/chatkit';
import { CHANNEL_LONG_PRESS, CHANNEL_PRESS } from '../actions';
import { badge, caption, col, image, row, text } from '../primitives';

export interface ChannelRowParams {
  convId: string;
  avatarUri: string;
  title: string;
  preview: string;
  timestamp: string;
  unreadBadge?: string;
}

export function channelRow(params: ChannelRowParams): ListViewItemNode {
  const meta = col(
    [
      caption(params.timestamp, { color: 'secondary' }),
      ...(params.unreadBadge
        ? [badge(params.unreadBadge, { color: 'info', size: 'sm', pill: true })]
        : []),
    ],
    { gap: 4, align: 'end' },
  );

  const body = col(
    [
      text(params.title, { weight: 'semibold', truncate: true }),
      caption(params.preview, { color: 'secondary', truncate: true, maxLines: 1 }),
    ],
    { gap: 2, flex: 1 },
  );

  return {
    type: 'ListViewItem',
    onClickAction: {
      type: CHANNEL_PRESS,
      payload: { convId: params.convId, longPressType: CHANNEL_LONG_PRESS },
    },
    align: 'center',
    gap: 12,
    children: [
      row(
        [image(params.avatarUri, { size: 44, radius: 'full' }), body, meta],
        { align: 'center', gap: 12, flex: 1 },
      ),
    ],
  };
}
