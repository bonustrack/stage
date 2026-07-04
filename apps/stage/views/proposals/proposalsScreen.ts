export function proposalsEmptyLabel(loading: boolean): string {
  return loading ? 'Loading requests…' : 'No pending requests';
}

export function proposalsPositionLabel(position: number, total: number): string {
  return `${position} of ${total}`;
}
