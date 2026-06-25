import type { RowNode } from '@stage-labs/kit/kit';
import view from './nftGrid.json';
import { buildView } from '../buildView';
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
  return (buildView(view, {
    cardBg: params.cardBg,
    openType: params.openType ?? LINK_OPEN,
    items: params.items.map((it) => ({
      title: it.title,
      collection: it.collection,
      image: it.image !== undefined && it.image !== '' ? it.image : undefined,
      noImage: it.image === undefined || it.image === '' ? true : undefined,
      payload: { url: it.url ?? '' },
    })),
  }) as RowNode);
}
