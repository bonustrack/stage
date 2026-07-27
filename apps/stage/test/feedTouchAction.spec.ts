import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const bubbleGestures = read('components', 'MessengerBubble.gestures.ts');
const swipeTabs = read('components', 'SwipeTabs.tsx');

describe('touch dragging a message bubble still scrolls the feed on mobile web', () => {
  test('every bubble gesture opts out of the touch-action: none default', () => {
    expect(bubbleGestures).toContain("gesture.config.touchAction = 'pan-y';");
    const wrapped = bubbleGestures.match(/keepsFeedScrollable\(/g) ?? [];
    expect(wrapped.length).toBe(3);
  });

  test('the pan, double tap and long press gestures are all wrapped', () => {
    for (const factory of ['Gesture.Pan()', 'Gesture.Tap()', 'Gesture.LongPress()']) {
      const at = bubbleGestures.indexOf(factory);
      expect([factory, at]).not.toEqual([factory, -1]);
      expect(bubbleGestures.slice(Math.max(0, at - 120), at)).toContain('keepsFeedScrollable(');
    }
  });

  test('pan-y still leaves horizontal swipe-to-reply to the gesture handler', () => {
    expect(bubbleGestures).toContain('.activeOffsetX(-15)');
    expect(bubbleGestures).toContain('.failOffsetY([-12, 12])');
  });

  test('the tab pager gesture stays disabled on web, so it stamps nothing', () => {
    expect(swipeTabs).toContain('.enabled(!IS_WEB)');
  });
});
