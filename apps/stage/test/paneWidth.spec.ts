import { describe, expect, test } from 'bun:test';
import { isMinWidth } from '../components/tabs/paneWidth.model';

describe('isMinWidth', () => {
  test('a pane at its minimum width is at min', () => {
    expect(isMinWidth(280, 280)).toBe(true);
  });

  test('a pane a few pixels above its minimum still counts as min', () => {
    expect(isMinWidth(284, 280)).toBe(true);
  });

  test('a wider pane is not at min', () => {
    expect(isMinWidth(285, 280)).toBe(false);
    expect(isMinWidth(380, 280)).toBe(false);
  });
});
