import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';

export interface TopnavIdentityParams {
  avatarUri?: string;
  avatarBackground?: string;
  name: string;
}

function avatarNode(params: TopnavIdentityParams): WidgetNode {
  const hasAvatar = params.avatarUri !== undefined && params.avatarUri !== '';
  if (hasAvatar) {
    return {
      type: 'Image',
      src: params.avatarUri ?? '',
      size: 28,
      radius: 'full',
      background: params.avatarBackground,
    };
  }
  return {
    type: 'Col',
    size: 28,
    radius: 'full',
    background: params.avatarBackground,
  };
}

export function topnavIdentity(params: TopnavIdentityParams): RowNode {
  const hasName = params.name !== '';
  const children = compactList<WidgetNode>([
    avatarNode(params),
    hasName
      ? {
          type: 'Row',
          maxWidth: 200,
          children: [
            {
              type: 'Text',
              value: params.name,
              size: '4xl',
              weight: 'semibold',
              color: 'link',
              truncate: true,
            },
          ],
        }
      : undefined,
  ]);
  return { type: 'Row', align: 'center', gap: 8, children };
}
