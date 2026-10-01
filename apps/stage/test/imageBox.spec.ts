import { describe, expect, test } from 'bun:test';
import { ATTACHMENT_MAX_HEIGHT, VIDEO_PLACEHOLDER_RATIO, mediaAspectRatio, mediaMaxWidth, validSize } from '../components/bubble/imageBox.model';

describe('attachment layout', () => {
  test('media retain landscape, portrait and square ratios', () => {
    expect(mediaAspectRatio({ width: 2560, height: 1600 })).toBe(1.6);
    expect(mediaAspectRatio({ width: 2560, height: 6000 })).toBeCloseTo(2560 / 6000);
    expect(mediaAspectRatio({ width: 800, height: 800 })).toBe(1);
  });

  test('images use a square placeholder until their size is known', () => {
    expect(mediaAspectRatio(undefined)).toBe(1);
    expect(mediaAspectRatio({ width: 640 })).toBe(1);
    expect(mediaAspectRatio({ width: 0, height: 480 })).toBe(1);
  });

  test('videos use a 16:9 placeholder until their size is known', () => {
    expect(mediaAspectRatio(undefined, VIDEO_PLACEHOLDER_RATIO)).toBe(16 / 9);
    expect(mediaAspectRatio({ width: 1080, height: 1920 }, VIDEO_PLACEHOLDER_RATIO)).toBe(0.5625);
  });

  test('portrait media narrow so they never pass the max height', () => {
    expect(mediaMaxWidth(9 / 16)).toBe(225);
    expect(mediaMaxWidth(3 / 4)).toBe(300);
    expect(mediaMaxWidth(16 / 9) / (16 / 9)).toBe(ATTACHMENT_MAX_HEIGHT);
  });

  test('accepts only a positive measured size', () => {
    expect(validSize({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 });
    expect(validSize({ width: 0, height: 480 })).toBeUndefined();
    expect(validSize({ width: 640, height: 0 })).toBeUndefined();
    expect(validSize({ width: 640 })).toBeUndefined();
    expect(validSize(undefined)).toBeUndefined();
  });
});
