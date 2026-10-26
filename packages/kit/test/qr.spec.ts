import { describe, expect, test } from 'bun:test';
import { buildQrMatrix } from '../src/qr';

function darkCells(path: string): number {
  return path.split('M').length - 1;
}

describe('buildQrMatrix', () => {
  test('a short link is a 25 module code with its finder pattern in the top-left corner', () => {
    const qr = buildQrMatrix('https://stage.box', 100);
    expect(qr.count).toBe(25);
    expect(qr.cell).toBe(4);
    expect(qr.path.startsWith('M0 0h4v4h-4zM4 0h4v4h-4z')).toBe(true);
    expect(darkCells(qr.path)).toBeGreaterThan(200);
  });

  test('an empty value still draws the smallest code, and longer data grows it', () => {
    expect(buildQrMatrix('', 42).count).toBe(21);
    expect(buildQrMatrix('x'.repeat(200), 100).count).toBeGreaterThan(25);
  });
});
