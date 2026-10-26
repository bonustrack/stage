import { describe, expect, test } from 'bun:test';
import { createA2uiClient } from '../../src/a2ui/client';
import { isSafeRegex } from '../../src/a2ui/functions';
import { KIT_CATALOG_ID } from '../../src/a2ui/kit-catalog';
import { setAt } from '../../src/a2ui/pointer';
import type { JsonObject } from '../../src/a2ui/protocol';
import { RENDER_LIMITS, fitsRenderLimits } from '../../src/a2ui/structure';
import { isColorToken } from '../../src/tokens';
import { colorValueOf, lengthOf, spacingOf } from '../../src/react-native/a2ui-context';

function surfaceOf(components: JsonObject[], dataModel: JsonObject = {}) {
  const client = createA2uiClient();
  client.receive({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: KIT_CATALOG_ID, dataModel, components } });
  const surface = client.surface('s');
  if (surface === undefined) throw new Error('no surface');
  return { surface, registry: client.registry };
}

const text = (id: string): JsonObject => ({ id, component: 'Text', text: id });

describe('regex checks', () => {
  test('patterns that backtrack exponentially are refused, ordinary ones pass', () => {
    for (const p of ['((a+))+$', '(a|a)*$', '(a|aa)+$', '(a+)+', '(a*)*b', '(x+x+)+y', '(a?){20}', '(.*a){12}', '(a)\\1', '(?<n>a)\\k<n>', 'a'.repeat(1001)]) {
      expect([p.slice(0, 20), isSafeRegex(p)]).toEqual([p.slice(0, 20), false]);
    }
    for (const p of ['^[a-z]+$', '^\\d{3}-\\d{4}$', '^[^@]+@[^@]+\\.[a-z]{2,}$', '^(foo|bar)$', '^(abc)+$', '[(+*]+', '^\\(\\d+\\)$']) {
      expect([p, isSafeRegex(p)]).toEqual([p, true]);
    }
  });
});

describe('data model writes', () => {
  test('an array index past the end is ignored, and only canonical indexes write', () => {
    expect(setAt({ a: [1] }, '/a/4294967294', 2)).toEqual({ a: [1] });
    expect(setAt({ a: [1] }, '/a/1', 2)).toEqual({ a: [1, 2] });
    expect(setAt({ a: [1] }, '/a/-', 3)).toEqual({ a: [1, 3] });
    expect(setAt({ a: [1] }, '/a/01', 3)).toEqual({ a: [1] });
    expect(setAt({ a: [1] }, '/a/1e3', 3)).toEqual({ a: [1] });
  });
});

describe('render limits', () => {
  test('a normal tree fits', () => {
    const { surface, registry } = surfaceOf([{ id: 'root', component: 'Column', children: ['a', 'b'] }, text('a'), text('b')]);
    expect(fitsRenderLimits(surface, registry)).toBe(true);
  });

  test('a component that contains itself, directly or through a template, does not render', () => {
    const self = surfaceOf([{ id: 'root', component: 'Column', children: ['root'] }]);
    expect(fitsRenderLimits(self.surface, self.registry)).toBe(false);
    const loop = surfaceOf([
      { id: 'root', component: 'Column', children: ['item'] },
      { id: 'item', component: 'Column', children: { componentId: 'item', path: '/rows' } },
    ], { rows: [{ rows: [] }] });
    expect(fitsRenderLimits(loop.surface, loop.registry)).toBe(false);
  });

  test('too deep or too many nodes does not render', () => {
    const deep = Array.from({ length: RENDER_LIMITS.depth + 1 }, (_, i): JsonObject => ({ id: i === 0 ? 'root' : `c${i}`, component: 'Column', children: [`c${i + 1}`] }));
    const tall = surfaceOf(deep);
    expect(fitsRenderLimits(tall.surface, tall.registry)).toBe(false);
    const grid = surfaceOf([
      { id: 'root', component: 'Column', children: { componentId: 'row', path: '/rows' } },
      { id: 'row', component: 'Row', children: { componentId: 'cell', path: 'cells' } },
      text('cell'),
    ], { rows: Array.from({ length: 60 }, () => ({ cells: Array.from({ length: 60 }, () => 0) })) });
    expect(fitsRenderLimits(grid.surface, grid.registry)).toBe(false);
  });
});

describe('unvalidated input', () => {
  test('an unknown or malformed message is reported, never thrown', () => {
    const diagnostics: string[] = [];
    const client = createA2uiClient({ validate: false, onDiagnostic: (d) => { diagnostics.push(d.message); } });
    expect(() => {
      client.receive({ version: 'v2.0', createSurfaceX: { surfaceId: 's' } });
      client.receive({ version: 'v1.0', updateComponents: { surfaceId: 'missing', components: 'nope' } });
      client.receive('{not json');
    }).not.toThrow();
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);
  });
});

describe('colour tokens', () => {
  test('only real token names count, not object keys', () => {
    expect(['primary', 'secondary', 'danger'].every(isColorToken)).toBe(true);
    expect(['constructor', 'toString', '__proto__', 'hasOwnProperty'].some(isColorToken)).toBe(false);
  });
});


describe('bound style values', () => {
  test('colours from data are Kit tokens or hex only', () => {
    expect(['danger', '#ff0000', '#f00', '#ff000080'].map(colorValueOf)).toEqual(['danger', '#ff0000', '#f00', '#ff000080']);
    expect(['red; background: url(x)', 'url(x)', 'constructor', 'rgb(0,0,0)', 7].map(colorValueOf)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  test('lengths are pixels or a percentage, padding keeps only known sides', () => {
    expect([40, 0, '40%', '100%', '12.5%'].map(lengthOf)).toEqual([40, 0, '40%', '100%', '12.5%']);
    expect(['40px', '101%', -1, 'calc(1px)', Number.NaN].map(lengthOf)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(spacingOf({ x: 8, top: 4, bogus: 3, left: -1 })).toEqual({ x: 8, top: 4 });
    expect([spacingOf(12), spacingOf(-1), spacingOf({ bogus: 1 })]).toEqual([12, undefined, undefined]);
  });
});
