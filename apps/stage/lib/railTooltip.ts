import { makeListeners, useStoreValue } from './storeCore';

export interface RailTooltipState { label: string; anchorRight: number; centerY: number }

let current: RailTooltipState | null = null;
const listeners = makeListeners();

export function showRailTooltip(next: RailTooltipState): void { current = next; listeners.notify(); }
export function hideRailTooltip(): void { if (current === null) return; current = null; listeners.notify(); }
function getRailTooltip(): RailTooltipState | null { return current; }

export function useRailTooltip(): RailTooltipState | null {
  return useStoreValue(listeners.subscribe, getRailTooltip);
}
