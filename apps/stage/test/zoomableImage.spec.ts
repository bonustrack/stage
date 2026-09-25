import { describe, expect, test } from 'bun:test';
import {
  clampOffset, clampZoom, doubleTapTarget, isZoomed, panLimits, zoomAround,
  ZOOM_DOUBLE_TAP, ZOOM_MAX, ZOOM_MIN, ZOOM_RESET, type ZoomGeometry, type ZoomPoint, type ZoomState,
} from '../components/ZoomableImage.model';

const square: ZoomGeometry = {
  view: { width: 400, height: 800 },
  natural: { width: 1000, height: 1000 },
  frame: { x: 0, y: 0 },
};

const framed: ZoomGeometry = {
  view: { width: 390, height: 844 },
  natural: { width: 2000, height: 1000 },
  frame: { x: 18, y: 104 },
};

function screenOf(state: ZoomState, point: ZoomPoint): ZoomPoint {
  return { x: state.x + state.scale * point.x, y: state.y + state.scale * point.y };
}

describe('clampZoom', () => {
  test('keeps the scale between 1x and 4x', () => {
    expect(clampZoom(0.3)).toBe(ZOOM_MIN);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
  });
});

describe('isZoomed', () => {
  test('ignores float noise around 1x', () => {
    expect(isZoomed(1)).toBe(false);
    expect(isZoomed(1.005)).toBe(false);
    expect(isZoomed(1.2)).toBe(true);
  });
});

describe('panLimits', () => {
  test('allows no pan at 1x', () => {
    expect(panLimits(square, 1)).toEqual({ x: 0, y: 0 });
  });

  test('pans only along the axis the zoomed image overflows', () => {
    expect(panLimits(square, 2)).toEqual({ x: 200, y: 0 });
    expect(panLimits(square, 4)).toEqual({ x: 600, y: 400 });
  });

  test('fits the image inside the frame before measuring the overflow', () => {
    const limits = panLimits(framed, 2);
    expect(limits.x).toBeCloseTo((354 * 2 - 390) / 2);
    expect(limits.y).toBe(0);
  });

  test('falls back to the framed box before the image size is known', () => {
    const unknown = { ...framed, natural: { width: 0, height: 0 } };
    expect(panLimits(unknown, 2)).toEqual({ x: (354 * 2 - 390) / 2, y: (636 * 2 - 844) / 2 });
  });
});

describe('clampOffset', () => {
  test('keeps the image edges on screen', () => {
    expect(clampOffset({ x: 900, y: -50 }, square, 2)).toEqual({ x: 200, y: 0 });
    expect(clampOffset({ x: -900, y: 50 }, square, 4)).toEqual({ x: -600, y: 50 });
  });
});

describe('zoomAround', () => {
  test('keeps the pinched point under the fingers', () => {
    const focal = { x: 60, y: 90 };
    const next = zoomAround(ZOOM_RESET, focal, focal, 3, square);
    expect(next.scale).toBe(3);
    const screen = screenOf(next, focal);
    expect(screen.x).toBeCloseTo(focal.x);
    expect(screen.y).toBeCloseTo(focal.y);
  });

  test('follows the focal point when the fingers move', () => {
    const next = zoomAround({ scale: 2, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 40, y: 0 }, 1, square);
    expect(next).toEqual({ scale: 2, x: 40, y: 0 });
  });

  test('clamps the scale and the offset together', () => {
    const focal = { x: 190, y: 300 };
    const next = zoomAround(ZOOM_RESET, focal, focal, 10, square);
    expect(next).toEqual({ scale: ZOOM_MAX, x: -570, y: -400 });
  });

  test('settles back to the centre when pinched below 1x', () => {
    expect(zoomAround({ scale: 2, x: 150, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.2, square))
      .toEqual({ scale: ZOOM_MIN, x: 0, y: 0 });
  });
});

describe('doubleTapTarget', () => {
  test('zooms in around the tapped point', () => {
    const tap = { x: 50, y: 0 };
    const next = doubleTapTarget(ZOOM_RESET, tap, square);
    expect(next.scale).toBe(ZOOM_DOUBLE_TAP);
    expect(screenOf(next, tap).x).toBeCloseTo(tap.x);
  });

  test('zooms back out when already zoomed', () => {
    expect(doubleTapTarget({ scale: 3, x: 120, y: 40 }, { x: 10, y: 10 }, square)).toEqual(ZOOM_RESET);
  });
});
