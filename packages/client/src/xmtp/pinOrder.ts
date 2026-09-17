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

export function pinRank(order: PinOrder): ReadonlyMap<string, number> {
  return new Map(order.map((id, i) => [id, i]));
}
