import { makeValue } from './storeCore';

export type RailTooltipState =
  | { placement: 'beside'; label: string; shortcut?: string; anchorRight: number; centerY: number }
  | { placement: 'above'; label: string; shortcut?: string; centerX: number; anchorTop: number }
  | { placement: 'below'; label: string; shortcut?: string; centerX: number; anchorBottom: number };

const ICON_HALF = 12;

export interface DomRectLike { left: number; top: number; width: number; height: number }

export function hoverRect(event: { currentTarget: unknown }): DomRectLike | undefined {
  const target = event.currentTarget as { getBoundingClientRect?: () => DomRectLike } | null;
  return target?.getBoundingClientRect?.();
}

export type TooltipPlacement = RailTooltipState['placement'];

export function tooltipState(placement: TooltipPlacement, label: string, rect: DomRectLike, shortcut?: string): RailTooltipState {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  if (placement === 'below') return { placement, label, shortcut, centerX, anchorBottom: centerY + ICON_HALF };
  if (placement === 'above') return { placement, label, shortcut, centerX, anchorTop: centerY - ICON_HALF };
  return { placement, label, shortcut, anchorRight: centerX + ICON_HALF, centerY };
}

export function bubbleShift(centerX: number, width: number, viewportWidth: number, margin: number): number {
  const half = width / 2;
  const overflowRight = centerX + half - (viewportWidth - margin);
  if (overflowRight > 0) return -overflowRight;
  const overflowLeft = margin - (centerX - half);
  return overflowLeft > 0 ? overflowLeft : 0;
}

export function tooltipLabel(text: string): string {
  return text.replace(/\.+$/, '');
}

const tooltip = makeValue<RailTooltipState | null>(null);

export function showRailTooltip(next: RailTooltipState): void { tooltip.set(next); }
export function hideRailTooltip(): void { if (tooltip.get() !== null) tooltip.set(null); }

export const useRailTooltip = tooltip.use;
