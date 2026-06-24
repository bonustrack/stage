import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { LINK_OPEN } from '../actions';
import { caption, col, image, text } from '../primitives';

export interface PreviewLinkCardParams {
  url: string;
  title: string;
  subtitle?: string;
  imageUri?: string;
}

export function previewLinkCard(params: PreviewLinkCardParams): ListViewItemNode {
  const body: WidgetNode[] = [text(params.title, { weight: 'semibold', truncate: true })];
  if (params.subtitle !== undefined && params.subtitle !== '') {
    body.push(caption(params.subtitle, { color: 'secondary', maxLines: 2 }));
  }

  const children: WidgetNode[] = [];
  if (params.imageUri !== undefined && params.imageUri !== '') {
    children.push(image(params.imageUri, { radius: 'md', maxHeight: 160, fit: 'cover' }));
  }
  children.push(col(body, { gap: 2, padding: { x: 12, y: 10 } }));

  return {
    type: 'ListViewItem',
    onClickAction: {
      type: LINK_OPEN,
      payload: { url: params.url },
    },
    children: [col(children, { radius: 'lg', gap: 0 })],
  };
}
