import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { LINK_OPEN } from '../actions';

export interface NftGridItem {
  title: string;
  collection?: string;
  image?: string;
  url?: string;
}

export interface NftGridParams {
  items: NftGridItem[];
  cardBg: string;
  openType?: string;
}

export function nftGrid(params: NftGridParams): RowNode {
  const openType = params.openType ?? LINK_OPEN;
  const children = params.items.map((it): WidgetNode => {
    const hasImage = it.image !== undefined && it.image !== '';
    const colChildren = compactList<WidgetNode>([
      hasImage
        ? {
            type: 'Image',
            src: it.image ?? '',
            fit: 'cover',
            width: '100%',
            aspectRatio: 1,
            radius: 'xl',
            background: params.cardBg,
          }
        : undefined,
      !hasImage
        ? {
            type: 'Box',
            width: '100%',
            aspectRatio: 1,
            radius: 'xl',
            background: params.cardBg,
            align: 'center',
            justify: 'center',
            children: [
              { type: 'Icon', name: 'photo', color: 'secondary', size: '2xl' },
            ],
          }
        : undefined,
      { type: 'Text', value: it.title, weight: 'semibold', color: 'link', truncate: true },
      it.collection !== undefined
        ? {
            type: 'Caption',
            value: it.collection,
            color: 'secondary',
            truncate: true,
          }
        : undefined,
    ]);
    return {
      type: 'Box',
      width: '50%',
      padding: 6,
      children: [
        {
          type: 'Pressable',
          onClickAction: { type: openType, payload: { url: it.url ?? '' } },
          children: [{ type: 'Col', gap: 6, children: colChildren }],
        },
      ],
    };
  });
  return { type: 'Row', wrap: 'wrap', children };
}
