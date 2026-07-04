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
