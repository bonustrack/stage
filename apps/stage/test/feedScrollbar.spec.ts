import { describe, expect, test } from 'bun:test';
import { showsInvertedScrollbar } from '../components/xmtp-conv/feed-helpers';

describe('the inverted feed only shows its mirrored scrollbar where it reads correctly', () => {
  test('desktop web keeps the window-edge scrollbar', () => {
    expect(showsInvertedScrollbar(true, false)).toBe(true);
  });

  test('touch web hides it, because the scaleY(-1) mirror flips the indicator', () => {
    expect(showsInvertedScrollbar(true, true)).toBe(false);
  });

  test('native never renders a web scroll indicator either way', () => {
    expect(showsInvertedScrollbar(false, true)).toBe(false);
    expect(showsInvertedScrollbar(false, false)).toBe(false);
  });
});
