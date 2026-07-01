import { describe, expect, test } from 'bun:test';
import {
  boxStyleEntries,
  surfaceColor,
  type BoxBaseProps,
  type Surface,
  type SurfacePalette,
} from '../src/layout';

const PALETTE: SurfacePalette = {
  bg: '#bg0000',
  inputBg: '#input0',
  toolbarBg: '#toolbr',
};

describe('surfaceColor', () => {
  const cases: [Surface, string | undefined][] = [
    ['none', undefined],
    ['surface', PALETTE.bg],
    ['raised', PALETTE.inputBg],
    ['sunken', PALETTE.bg],
    ['toolbar', PALETTE.toolbarBg],
  ];

  for (const [surface, expected] of cases) {
    test(`${surface} -> ${String(expected)}`, () => {
      expect(surfaceColor(surface, PALETTE)).toBe(expected as string);
    });
  }
});

describe('boxStyleEntries', () => {
  test('minimal input snapshot (only flexDirection defaults)', () => {
    expect(boxStyleEntries({})).toMatchSnapshot();
  });

  test('representative full input snapshot', () => {
    const props: BoxBaseProps = {
      direction: 'row',
      gap: 8,
      padding: { x: 12, top: 4 },
      margin: 16,
      align: 'center',
      justify: 'between',
      flex: 1,
      wrap: true,
      background: 'bg-dark',
      radius: 'soft',
      width: '100%',
      height: 40,
      size: 32,
      minWidth: 10,
      minHeight: 20,
      maxWidth: 300,
      maxHeight: '80%',
      aspectRatio: 1.5,
      border: {
        top: { width: 1, color: '#111111', style: 'dashed' },
        bottom: { width: 2, color: '#222222' },
      },
    };
    expect(boxStyleEntries(props)).toMatchSnapshot();
  });

  test('explicit width/height override size', () => {
    const s = boxStyleEntries({ size: 32, width: 64 });
    expect(s.width).toBe(64);
    expect(s.height).toBe(32);
  });

  test('spacing sides override axis shorthand', () => {
    const s = boxStyleEntries({ padding: { x: 10, left: 2 } });
    expect(s.paddingLeft).toBe(2);
    expect(s.paddingRight).toBe(10);
  });

  test('background token resolves, raw color passes through', () => {
    expect(boxStyleEntries({ background: 'bg-light' }).backgroundColor).toBe('#ffffff');
    expect(boxStyleEntries({ background: '#123456' }).backgroundColor).toBe('#123456');
  });
});
