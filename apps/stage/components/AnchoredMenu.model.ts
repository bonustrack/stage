export interface MenuPoint { x: number; y: number }

export interface MenuViewport { width: number; height: number }

export interface AnchoredMenuStyle {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHeight: number;
}

export const MENU_EDGE_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function anchoredMenuStyle(point: MenuPoint, viewport: MenuViewport): AnchoredMenuStyle {
  const roomAbove = point.y - MENU_EDGE_MARGIN;
  const roomBelow = viewport.height - point.y - MENU_EDGE_MARGIN;
  const opensUp = roomAbove > roomBelow;
  const opensLeft = point.x > viewport.width / 2;
  const span = Math.max(0, viewport.height - MENU_EDGE_MARGIN * 2);
  return {
    ...(opensUp
      ? { bottom: clamp(viewport.height - point.y, MENU_EDGE_MARGIN, viewport.height) }
      : { top: clamp(point.y, MENU_EDGE_MARGIN, viewport.height) }),
    ...(opensLeft
      ? { right: clamp(viewport.width - point.x, MENU_EDGE_MARGIN, viewport.width) }
      : { left: clamp(point.x, MENU_EDGE_MARGIN, viewport.width) }),
    maxHeight: clamp(opensUp ? roomAbove : roomBelow, 0, span),
  };
}
