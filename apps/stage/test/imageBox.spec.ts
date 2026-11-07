import { describe, expect, test } from 'bun:test';
import { VIDEO_PLACEHOLDER_RATIO, mediaAspectRatio, mediaMaxWidth, validSize } from '../components/media/imageBox.model';

describe('attachment layout', () => {
  test('media retain landscape, portrait and square ratios', () => {
    expect(mediaAspectRatio({ width: 2560, height: 1600 })).toBe(1.6);
    expect(mediaAspectRatio({ width: 2560, height: 6000 })).toBeCloseTo(2560 / 6000);
    expect(mediaAspectRatio({ width: 800, height: 800 })).toBe(1);
  });

  test('images use a square placeholder until their size is known', () => {
    for (const size of [undefined, { width: 640 }, { width: 0, height: 480 }]) expect(mediaAspectRatio(size)).toBe(1);
  });

  test('videos use a 16:9 placeholder until their size is known', () => {
    expect(mediaAspectRatio(undefined, VIDEO_PLACEHOLDER_RATIO)).toBe(16 / 9);
    expect(mediaAspectRatio({ width: 1080, height: 1920 }, VIDEO_PLACEHOLDER_RATIO)).toBe(0.5625);
  });

  test('portrait media narrow so they never pass the max height', () => {
    expect(mediaMaxWidth(9 / 16)).toBe(225);
    expect(mediaMaxWidth(3 / 4)).toBe(300);
  });

  test('accepts only a positive measured size', () => {
    expect(validSize({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 });
    for (const size of [{ width: 0, height: 480 }, { width: 640, height: 0 }, { width: 640 }, undefined])
      expect(validSize(size)).toBeUndefined();
  });
});
