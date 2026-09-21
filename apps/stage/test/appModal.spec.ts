import { describe, expect, test } from 'bun:test';
import { CENTERED_MODAL_MAX_WIDTH, sheetPlacement } from '../components/AppModal.model';

describe('sheetPlacement', () => {
  test('wide screens get a centered, width-capped panel without sheet chrome', () => {
    expect(sheetPlacement(true, 28)).toEqual({
      side: 'center', panelWidth: '100%', panelMaxWidth: CENTERED_MODAL_MAX_WIDTH, safeAreaBottom: false, handle: false, bottomPad: 16,
    });
  });
  test('small screens keep the bottom sheet with its own bottom padding', () => {
    expect(sheetPlacement(false, 28)).toEqual({ side: 'bottom', safeAreaBottom: true, handle: true, bottomPad: 28 });
  });
});
