export const CENTERED_MODAL_MAX_WIDTH = 480;
export const CENTERED_MODAL_PAD = 16;

export interface SheetPlacement {
  side: 'center' | 'bottom';
  panelWidth?: string;
  panelMaxWidth?: number;
  safeAreaBottom: boolean;
  handle: boolean;
  bottomPad: number;
}

export function sheetPlacement(wide: boolean, sheetBottomPad: number): SheetPlacement {
  return wide
    ? { side: 'center', panelWidth: '100%', panelMaxWidth: CENTERED_MODAL_MAX_WIDTH, safeAreaBottom: false, handle: false, bottomPad: CENTERED_MODAL_PAD }
    : { side: 'bottom', safeAreaBottom: true, handle: true, bottomPad: sheetBottomPad };
}
