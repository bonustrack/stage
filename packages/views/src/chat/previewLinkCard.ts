import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { LINK_OPEN } from '../actions';

export interface PreviewLinkCardParams {
  url: string;
  title: string;
  subtitle?: string;
  imageUri?: string;
}

export function previewLinkCard(params: PreviewLinkCardParams): ListViewItemNode {
  const hasSubtitle = params.subtitle !== undefined && params.subtitle !== '';
  const hasImage = params.imageUri !== undefined && params.imageUri !== '';
  const colChildren = compactList<WidgetNode>([
    hasImage
      ? {
          type: 'Image',
          src: params.imageUri ?? '',
          radius: 'md',
          maxHeight: 160,
          fit: 'cover',
        }
      : undefined,
    {
      type: 'Col',
      gap: 2,
      padding: { x: 12, y: 10 },
      children: compactList<WidgetNode>([
        { type: 'Text', value: params.title, weight: 'semibold', truncate: true },
        hasSubtitle
          ? {
              type: 'Caption',
              value: params.subtitle ?? '',
              color: 'secondary',
              maxLines: 2,
            }
          : undefined,
      ]),
    },
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: { type: LINK_OPEN, payload: { url: params.url } },
    children: [{ type: 'Col', radius: 'lg', gap: 0, children: colChildren }],
  };
}
