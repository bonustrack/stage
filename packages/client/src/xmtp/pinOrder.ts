export type PinOrder = readonly string[];

export function toggledPinOrder(order: PinOrder, convId: string): PinOrder {
  return order.includes(convId) ? order.filter((id) => id !== convId) : [convId, ...order];
}

export function movedPinOrder(order: PinOrder, convId: string, toIndex: number): PinOrder {
  const from = order.indexOf(convId);
  if (from === -1) return order;
  const to = Math.max(0, Math.min(toIndex, order.length - 1));
  if (to === from) return order;
  const next = order.filter((id) => id !== convId);
  next.splice(to, 0, convId);
  return next;
}

export function pinOrderAfterRemote(
  order: PinOrder, state: { convId: string; pinned: boolean; order?: readonly string[] },
): PinOrder {
  if (state.order !== undefined) return state.order;
  const pinned = order.includes(state.convId);
  if (pinned === state.pinned) return order;
  return toggledPinOrder(order, state.convId);
}

export function savedFirst<T>(
  items: readonly T[], order: readonly string[], keyOf: (item: T) => string, rest: (a: T, b: T) => number = () => 0,
): T[] {
  const rank = new Map<string, number>();
  order.forEach((key, index) => { if (!rank.has(key)) rank.set(key, index); });
  return [...items].sort((a, b) => {
    const ra = rank.get(keyOf(a));
    const rb = rank.get(keyOf(b));
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined || rb !== undefined) return ra === undefined ? 1 : -1;
    return rest(a, b);
  });
}

export function movedKey(order: readonly string[], key: string, target: string): string[] {
  return [...movedPinOrder(order, key, order.indexOf(target))];
}
