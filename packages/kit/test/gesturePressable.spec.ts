import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(import.meta.dir, '..', 'src', 'react-native', 'gesture-pressable.tsx'),
  'utf8',
);

describe('a pressable never freezes the surface it sits on', () => {
  test('tap-only pressables let the browser pan in both axes', () => {
    expect(src).toContain("const touchAction = onSwipe ? 'none' : 'manipulation';");
  });

  test('all three composed gestures carry the same touch action', () => {
    expect(src).toContain('for (const g of [tap, long, pan]) g.config.touchAction = touchAction;');
  });

  test('swipe consumers keep owning the gesture outright', () => {
    expect(src).toContain('onSwipe?: (direction: SwipeDir) => void;');
  });
});
