import type { ListViewItemNode } from '@stage-labs/kit/kit';
import view from './previewLinkCard.json';
import { buildView } from '../buildView';
import { LINK_OPEN } from '../actions';

export interface PreviewLinkCardParams {
  url: string;
  title: string;
  subtitle?: string;
  imageUri?: string;
}

export function previewLinkCard(params: PreviewLinkCardParams): ListViewItemNode {
  return (buildView(view, {
    linkAction: LINK_OPEN,
    url: params.url,
    title: params.title,
    subtitle: params.subtitle,
    imageUri: params.imageUri,
    hasSubtitle:
      (params.subtitle !== undefined && params.subtitle !== '') || undefined,
    hasImage:
      (params.imageUri !== undefined && params.imageUri !== '') || undefined,
  }) as ListViewItemNode);
}
