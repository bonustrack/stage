export type ConvKind = 'dm' | 'group' | 'unknown';

export function convKindOf(row: { peerAddress: string | null } | null): ConvKind {
  if (row === null) return 'unknown';
  return row.peerAddress === null ? 'group' : 'dm';
}

export function gatedAsChannel(kind: ConvKind): boolean {
  return kind !== 'dm';
}
