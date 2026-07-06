
export const MENU_SCREEN_MARGIN = 40;
export const MENU_STRIP_HEIGHT = 52;
export const MENU_GAP = 6;

export interface MenuPlacement {
  stripTop: number;
  dropdownAbove: boolean;
}

function actionDropdownHeight(hasText: boolean): number {
  const actionCount = 2 + (hasText ? 2 : 0);
  return actionCount * 48 + 16;
}

export function menuPlacement(anchorY: number, hasText: boolean, windowHeight: number): MenuPlacement {
  const dropdownH = actionDropdownHeight(hasText);
  const maxStripTop = windowHeight - MENU_SCREEN_MARGIN - MENU_STRIP_HEIGHT;
  const stripTop = Math.max(MENU_SCREEN_MARGIN, Math.min(anchorY, maxStripTop));
  const roomBelow = windowHeight - MENU_SCREEN_MARGIN - (stripTop + MENU_STRIP_HEIGHT + MENU_GAP);
  const fitsBelow = roomBelow >= dropdownH;
  const fitsAbove = stripTop - MENU_GAP - dropdownH >= MENU_SCREEN_MARGIN;
  const dropdownAbove = !fitsBelow && fitsAbove;
  return { stripTop, dropdownAbove };
}
