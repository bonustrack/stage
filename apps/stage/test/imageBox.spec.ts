import { describe, expect, test } from 'bun:test';
import { imageBox, sameSize, validSize } from '../components/bubble/imageBox.model';

describe('image box', () => {
  test('fits a tall image inside 300 by 300 at its ratio', () => {
    expect(imageBox({ width: 1170, height: 2532 })).toEqual({ width: 139, height: 300, aspectRatio: 1170 / 2532 });
  });

  test('fits a wide image inside 300 by 300 at its ratio', () => {
    expect(imageBox({ width: 1262, height: 896 })).toEqual({ width: 300, height: 213, aspectRatio: 1262 / 896 });
  });

  test('shows a large square image at 300 by 300', () => {
    expect(imageBox({ width: 1024, height: 1024 })).toEqual({ width: 300, height: 300, aspectRatio: 1 });
  });

  test('keeps a small image at its own size', () => {
    expect(imageBox({ width: 120, height: 80 })).toEqual({ width: 120, height: 80, aspectRatio: 1.5 });
  });

  test('reserves the full square until the size is known', () => {
    expect(imageBox(undefined)).toEqual({ width: 300, height: 300, aspectRatio: 1 });
  });

  test('accepts only a positive measured size', () => {
    expect(validSize({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 });
    expect(validSize({ width: 0, height: 480 })).toBeUndefined();
    expect(validSize({ width: 640, height: 0 })).toBeUndefined();
    expect(validSize({ width: 640 })).toBeUndefined();
    expect(validSize(undefined)).toBeUndefined();
  });

  test('compares sizes', () => {
    expect(sameSize({ width: 1, height: 2 }, { width: 1, height: 2 })).toBe(true);
    expect(sameSize(undefined, { width: 1, height: 2 })).toBe(false);
    expect(sameSize({ width: 1, height: 3 }, { width: 1, height: 2 })).toBe(false);
  });
});
