import { describe, expect, test } from 'bun:test';
import { menuPlacement, MENU_SCREEN_MARGIN, MENU_STRIP_HEIGHT } from '../components/xmtp-conv/menuPlacement';

const WINDOW = 800;

describe('menuPlacement', () => {
  test('mid-screen bubble keeps the strip at the bubble with the dropdown below', () => {
    const { stripTop, dropdownAbove } = menuPlacement(200, true, WINDOW);
    expect(stripTop).toBe(200);
    expect(dropdownAbove).toBe(false);
  });

  test('bottom bubble keeps the strip next to the bubble and flips the dropdown above', () => {
    const anchorY = WINDOW - 120;
    const { stripTop, dropdownAbove } = menuPlacement(anchorY, true, WINDOW);
    expect(stripTop).toBe(anchorY);
    expect(dropdownAbove).toBe(true);
  });

  test('strip never leaves the bottom safe area', () => {
    const { stripTop } = menuPlacement(WINDOW + 500, false, WINDOW);
    expect(stripTop).toBe(WINDOW - MENU_SCREEN_MARGIN - MENU_STRIP_HEIGHT);
  });

  test('strip never leaves the top safe area', () => {
    const { stripTop } = menuPlacement(-100, false, WINDOW);
    expect(stripTop).toBe(MENU_SCREEN_MARGIN);
  });

  test('text and non-text bottom bubbles both keep the strip anchored to the bubble', () => {
    const anchorY = WINDOW - 120;
    expect(menuPlacement(anchorY, true, WINDOW).stripTop).toBe(anchorY);
    expect(menuPlacement(anchorY, false, WINDOW).stripTop).toBe(anchorY);
  });
});
