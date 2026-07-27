import { describe, expect, test } from 'bun:test';
import { invertedThumb, MIN_THUMB_HEIGHT } from '../components/xmtp-conv/feed-helpers';

const TRACK = 600;
const metrics = (offset: number) => ({ offset, contentHeight: 3000, viewportHeight: 800 });

describe('the drawn scrollbar reads the way an inverted feed looks', () => {
  test('sitting on the newest message puts the handle at the bottom', () => {
    expect(invertedThumb(metrics(0), TRACK)?.bottom).toBe(0);
  });

  test('reaching the oldest message puts the handle at the top', () => {
    const thumb = invertedThumb(metrics(3000 - 800), TRACK);
    expect(thumb).not.toBeNull();
    expect(thumb?.bottom).toBeCloseTo(TRACK - (thumb?.height ?? 0), 5);
  });

  test('the handle travels monotonically back through history', () => {
    const walk = [0, 400, 900, 1500, 2200].map(o => invertedThumb(metrics(o), TRACK)?.bottom ?? -1);
    for (let i = 1; i < walk.length; i += 1) {
      expect(walk[i]).toBeGreaterThan(walk[i - 1] ?? 0);
    }
  });

  test('the handle is sized by how much of the history fits on screen', () => {
    const short = invertedThumb({ offset: 0, contentHeight: 1600, viewportHeight: 800 }, TRACK);
    const long = invertedThumb({ offset: 0, contentHeight: 8000, viewportHeight: 800 }, TRACK);
    const huge = invertedThumb({ offset: 0, contentHeight: 40_000, viewportHeight: 800 }, TRACK);
    expect(short?.height).toBe(300);
    expect(long?.height).toBe(60);
    expect(huge?.height).toBe(MIN_THUMB_HEIGHT);
  });

  test('nothing is drawn when the feed does not scroll', () => {
    expect(invertedThumb({ offset: 0, contentHeight: 700, viewportHeight: 800 }, TRACK)).toBeNull();
    expect(invertedThumb(metrics(0), MIN_THUMB_HEIGHT)).toBeNull();
  });

  test('an overscrolled offset never pushes the handle past the track', () => {
    const thumb = invertedThumb(metrics(9999), TRACK);
    expect(thumb?.bottom).toBeCloseTo(TRACK - (thumb?.height ?? 0), 5);
  });
});
