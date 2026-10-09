
export const MENU_SCREEN_MARGIN = 40;
export const MENU_STRIP_HEIGHT = 52;
export const STRIP_GAP = 6;

export interface MenuPlacement {
  stripTop: number;
  dropdownAbove: boolean;
}

function actionDropdownHeight(rows: number): number {
  return rows * 48 + 16;
}

export function menuPlacement(anchorY: number, rows: number, windowHeight: number): MenuPlacement {
  const dropdownH = actionDropdownHeight(rows);
  const maxStripTop = windowHeight - MENU_SCREEN_MARGIN - MENU_STRIP_HEIGHT;
  const stripTop = Math.max(MENU_SCREEN_MARGIN, Math.min(anchorY, maxStripTop));
  const roomBelow = windowHeight - MENU_SCREEN_MARGIN - (stripTop + MENU_STRIP_HEIGHT + STRIP_GAP);
  const fitsBelow = roomBelow >= dropdownH;
  const fitsAbove = stripTop - STRIP_GAP - dropdownH >= MENU_SCREEN_MARGIN;
  const dropdownAbove = !fitsBelow && fitsAbove;
  return { stripTop, dropdownAbove };
}
