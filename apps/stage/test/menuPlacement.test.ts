import { describe, expect, test } from 'bun:test';
import { menuPlacement, MENU_SCREEN_MARGIN, MENU_STRIP_HEIGHT, STRIP_GAP } from '../components/conversation/menuPlacement';

const WINDOW = 800;
const TWO_ROWS = 80;
const FOUR_ROWS = 152;

describe('menuPlacement', () => {
  test('mid-screen bubble keeps the strip at the bubble with the dropdown below', () => {
    const { stripTop, dropdownAbove } = menuPlacement(200, FOUR_ROWS, WINDOW);
    expect(stripTop).toBe(200);
    expect(dropdownAbove).toBe(false);
  });

  test('bottom bubble keeps the strip next to the bubble and flips the dropdown above', () => {
    const anchorY = WINDOW - 120;
    const { stripTop, dropdownAbove } = menuPlacement(anchorY, FOUR_ROWS, WINDOW);
    expect(stripTop).toBe(anchorY);
    expect(dropdownAbove).toBe(true);
  });

  test('strip never leaves the bottom safe area', () => {
    const { stripTop } = menuPlacement(WINDOW + 500, TWO_ROWS, WINDOW);
    expect(stripTop).toBe(WINDOW - MENU_SCREEN_MARGIN - MENU_STRIP_HEIGHT);
  });

  test('strip never leaves the top safe area', () => {
    const { stripTop } = menuPlacement(-100, TWO_ROWS, WINDOW);
    expect(stripTop).toBe(MENU_SCREEN_MARGIN);
  });

  test('the dropdown flips above once it no longer fits below', () => {
    const roomBelow = WINDOW - MENU_SCREEN_MARGIN - (470 + MENU_STRIP_HEIGHT + STRIP_GAP);
    expect(menuPlacement(470, roomBelow, WINDOW).dropdownAbove).toBe(false);
    expect(menuPlacement(470, roomBelow + 1, WINDOW).dropdownAbove).toBe(true);
  });

  test('text and non-text bottom bubbles both keep the strip anchored to the bubble', () => {
    const anchorY = WINDOW - 120;
    expect(menuPlacement(anchorY, FOUR_ROWS, WINDOW).stripTop).toBe(anchorY);
    expect(menuPlacement(anchorY, TWO_ROWS, WINDOW).stripTop).toBe(anchorY);
  });
});
