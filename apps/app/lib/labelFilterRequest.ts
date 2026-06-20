
import type { LabelFilterValue } from '../components/tabs/HomeScreen.filter.types';

let pending: { value: LabelFilterValue; seq: number } | null = null;
let seq = 0;
const listeners = new Set<(req: { value: LabelFilterValue; seq: number }) => void>();

export function requestLabelFilter(value: LabelFilterValue): void {
  const req = { value, seq: ++seq };
  pending = req;
  for (const l of listeners) l(req);
}

export function consumeLabelFilterRequest(): { value: LabelFilterValue; seq: number } | null {
  const req = pending;
  pending = null;
  return req;
}

export function subscribeLabelFilterRequest(
  l: (req: { value: LabelFilterValue; seq: number }) => void,
): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function clearPendingLabelFilter(): void { pending = null; }
