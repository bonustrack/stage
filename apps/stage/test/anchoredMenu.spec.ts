import { describe, expect, test } from 'bun:test';
import { anchoredMenuStyle, MENU_EDGE_MARGIN } from '../components/AnchoredMenu.model';

const VIEWPORT = { width: 1400, height: 900 };

describe('anchoredMenuStyle', () => {
  test('a point in the top left grows down and to the right', () => {
    const s = anchoredMenuStyle({ x: 200, y: 120 }, VIEWPORT);
    expect(s.top).toBe(120);
    expect(s.left).toBe(200);
    expect(s.bottom).toBeUndefined();
    expect(s.right).toBeUndefined();
  });

  test('a point in the bottom right grows up and to the left', () => {
    const s = anchoredMenuStyle({ x: 1300, y: 800 }, VIEWPORT);
    expect(s.bottom).toBe(100);
    expect(s.right).toBe(100);
    expect(s.top).toBeUndefined();
    expect(s.left).toBeUndefined();
  });

  test('the menu is capped to the room on the side it opens towards', () => {
    expect(anchoredMenuStyle({ x: 10, y: 100 }, VIEWPORT).maxHeight).toBe(792);
    expect(anchoredMenuStyle({ x: 10, y: 800 }, VIEWPORT).maxHeight).toBe(792);
  });

  test('an anchor past an edge is pulled back inside the viewport', () => {
    const s = anchoredMenuStyle({ x: -40, y: -40 }, VIEWPORT);
    expect(s.left).toBe(MENU_EDGE_MARGIN);
    expect(s.top).toBe(MENU_EDGE_MARGIN);
  });

  test('an anchor below the viewport still leaves room to render', () => {
    const s = anchoredMenuStyle({ x: 700, y: 2000 }, VIEWPORT);
    expect(s.bottom).toBe(MENU_EDGE_MARGIN);
    expect(s.maxHeight).toBe(VIEWPORT.height - MENU_EDGE_MARGIN * 2);
  });
});
