import type {
  ActionConfig,
  BoxNode,
  CardNode,
  ListViewItemNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { MEDIA_PRESS } from '../actions';

export interface MediaCardParams {
  mediaId?: string;
  children: WidgetNode[];
  width?: number;
  clickAction?: ActionConfig;
}

export function mediaCard(
  params: MediaCardParams,
): ListViewItemNode | BoxNode | CardNode {
  const action =
    params.clickAction ??
    (params.mediaId !== undefined
      ? { type: MEDIA_PRESS, payload: { mediaId: params.mediaId } }
      : undefined);
  const width = params.width ?? 280;
  const box: BoxNode = {
    type: 'Box',
    radius: 'lg',
    maxWidth: width,
    children: params.children,
  };
  if (action !== undefined) {
    return { type: 'ListViewItem', onClickAction: action, children: [box] };
  }
  return box;
}
