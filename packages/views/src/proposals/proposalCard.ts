import type { ColNode } from '@stage-labs/kit/kit';
import view from './proposalCard.json';
import { buildView } from '../buildView';

export interface ProposalCardParams {
  eyebrow: string;
  title: string;
  question?: string;
  authorName?: string;
  authorAvatarUri?: string;
  postedAt?: string;
}

function present(value: string | undefined): true | undefined {
  return value !== undefined && value !== '' ? true : undefined;
}

export function proposalCard(params: ProposalCardParams): ColNode {
  return buildView(view, {
    eyebrow: params.eyebrow.toUpperCase(),
    title: params.title,
    question: params.question,
    authorName: params.authorName,
    authorAvatarUri: params.authorAvatarUri,
    postedAt: params.postedAt,
    hasAuthor: present(params.authorName),
  }) as ColNode;
}
