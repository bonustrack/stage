export function proposalsEmptyLabel(loading: boolean): string {
  return loading ? 'Loading requests…' : 'No pending requests';
}

export function proposalsPositionLabel(position: number, total: number): string {
  return `${position} of ${total}`;
}

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
