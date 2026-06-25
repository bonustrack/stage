import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';

export interface ProposalCardParams {
  eyebrow: string;
  title: string;
  question?: string;
  authorName?: string;
  authorAvatarUri?: string;
  postedAt?: string;
}

function present(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

export function proposalCard(params: ProposalCardParams): ColNode {
  const authorChildren = compactList<WidgetNode>([
    params.authorAvatarUri !== undefined
      ? {
          type: 'Image',
          src: params.authorAvatarUri,
          size: 22,
          radius: 'full',
        }
      : undefined,
    {
      type: 'Text',
      value: params.authorName ?? '',
      weight: 'medium',
      size: 'sm',
      truncate: true,
    },
    params.postedAt !== undefined
      ? { type: 'Caption', value: params.postedAt, color: 'secondary' }
      : undefined,
  ]);
  const children = compactList<WidgetNode>([
    {
      type: 'Caption',
      value: params.eyebrow.toUpperCase(),
      color: 'secondary',
      weight: 'semibold',
    },
    { type: 'Title', value: params.title, color: 'link', truncate: true },
    params.question !== undefined
      ? {
          type: 'Col',
          padding: { top: 6 },
          children: [{ type: 'Title', value: params.question }],
        }
      : undefined,
    present(params.authorName)
      ? {
          type: 'Row',
          gap: 6,
          align: 'center',
          padding: { top: 8 },
          children: authorChildren,
        }
      : undefined,
  ]);
  return { type: 'Col', gap: 0, children };
}
