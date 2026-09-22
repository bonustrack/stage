import { makeListeners, useStoreValue } from './storeCore';

export type RailTooltipState =
  | { placement: 'beside'; label: string; anchorRight: number; centerY: number }
  | { placement: 'above'; label: string; centerX: number; anchorTop: number }
  | { placement: 'below'; label: string; centerX: number; anchorBottom: number };

export function tooltipLabel(text: string): string {
  return text.replace(/\.+$/, '');
}

let current: RailTooltipState | null = null;
const listeners = makeListeners();

export function showRailTooltip(next: RailTooltipState): void { current = next; listeners.notify(); }
export function hideRailTooltip(): void { if (current === null) return; current = null; listeners.notify(); }
function getRailTooltip(): RailTooltipState | null { return current; }

export function useRailTooltip(): RailTooltipState | null {
  return useStoreValue(listeners.subscribe, getRailTooltip);
}
