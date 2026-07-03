import type { WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { proposalCard } from './proposalCard';

export type ProposalRequestKind = 'poll' | 'payment' | 'signing' | 'message';

const KIND_LABEL: Record<ProposalRequestKind, string> = {
  poll: 'Poll',
  payment: 'Payment request',
  signing: 'Signing request',
  message: 'Message request',
};

export function proposalKindLabel(kind: ProposalRequestKind): string {
  return KIND_LABEL[kind];
}

export function proposalHeaderRoot(kind: ProposalRequestKind, title: string): WidgetRoot {
  return basicRoot(proposalCard({ eyebrow: proposalKindLabel(kind), title }));
}
