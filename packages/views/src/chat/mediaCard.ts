import type {
  ActionConfig,
  BoxNode,
  CardNode,
  ListViewItemNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import view from './mediaCard.json';
import { buildViewList } from '../buildView';
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
  const [node] = buildViewList(view, {
    hasAction: action !== undefined ? true : undefined,
    noAction: action === undefined ? true : undefined,
    action,
    width: params.width ?? 280,
    mediaChildren: params.children,
  });
  return node as ListViewItemNode | BoxNode;
}
