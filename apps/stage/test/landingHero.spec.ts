import { describe, expect, test } from 'bun:test';
import {
  ASCII, ASCII_GLYPH, asciiFrame, asciiGrid, asciiOrigin, asciiPath, glyphRect, heroBoxes, tornadoField,
} from '../components/landing/Landing.model';

const HALF = (): number => 0.5;

describe('heroBoxes', () => {
  test('sizes every box from the frame proportions', () => {
    const boxes = heroBoxes(4, 1000, 600, HALF);
    expect(boxes).toHaveLength(4);
    for (const box of boxes) {
      expect(box.width).toBe(250);
      expect(box.height).toBe(210);
      expect(box.x).toBe(Math.floor(0.5 * (1000 - 100) - 75));
      expect(box.y).toBe(Math.floor(0.5 * (600 - 84) - 63));
    }
  });
});

describe('asciiFrame', () => {
  test('grid follows the frame and caps the width', () => {
    expect(asciiGrid(1440, 900)).toEqual({ cols: Math.floor(1440 / ASCII.cellWidth), rows: 115 });
    expect(asciiGrid(4000, 80).cols).toBe(Math.floor(ASCII.maxWidth / ASCII.cellWidth));
  });

  test('renders rows of the requested width using only the palette', () => {
    const lines = asciiFrame(40, 12, 0).split('\n');
    expect(lines).toHaveLength(12);
    const palette = new Set<string>(ASCII.chars);
    for (const line of lines) {
      expect([...line]).toHaveLength(40);
      for (const ch of line) expect(palette.has(ch)).toBe(true);
    }
  });

  test('the eye of the storm stays blank', () => {
    const cols = 200;
    const rows = 100;
    const x = Math.round(cols * 0.5);
    const y = Math.round(rows * 0.5 + rows * 0.1);
    expect(tornadoField(x, y, cols, rows, 0)).toBeLessThan(-0.5);
    const line = asciiFrame(cols, rows, 0).split('\n')[y] ?? '';
    expect(line[x]).toBe(' ');
  });
});

describe('ascii glyph layout', () => {
  test('the grid is centred on the field at the Menlo pitch', () => {
    expect(asciiOrigin(1000, 400, 100, 50)).toEqual({ x: (1000 - 100 * ASCII_GLYPH.pitch) / 2, y: 0 });
  });

  test('period and dot sit on their Menlo boxes and other glyphs draw no rect', () => {
    const period = glyphRect('.', 10, 20);
    expect(period?.x).toBeCloseTo(12.66);
    expect(period?.y).toBeCloseTo(17.24);
    expect(period?.width).toBeCloseTo(2.41);
    expect(period?.height).toBeCloseTo(2.76);
    const dot = glyphRect('⋅', 0, 20);
    expect(dot?.y).toBeCloseTo(14.09);
    expect(dot?.height).toBeCloseTo(2.09);
    expect(glyphRect('^', 0, 20)).toBeNull();
    expect(glyphRect(' ', 0, 20)).toBeNull();
  });
});

describe('asciiPath', () => {
  test('draws one closed shape per visible glyph and nothing for spaces', () => {
    const d = asciiPath('^ .\n⋅  ', 100, 40);
    expect(d.match(/Z/g)?.length).toBe(3);
    expect(asciiPath('   \n   ', 100, 40)).toBe('');
  });

  test('caret, period and dot land on their Menlo boxes', () => {
    const origin = asciiOrigin(100, 40, 1, 1);
    const baseline = origin.y + ASCII_GLYPH.baseline;
    const period = glyphRect('.', origin.x, baseline);
    const d = asciiPath('.', 100, 40);
    expect(d.startsWith(`M${Math.round((period?.x ?? 0) * 10) / 10} `)).toBe(true);
  });
});
