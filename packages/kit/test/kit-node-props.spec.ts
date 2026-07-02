import { describe, expect, test } from 'bun:test';
import { boxProps } from '../src/vue/kit-node-props';

describe('boxProps', () => {
  test('omits undefined entries so component static bindings survive v-bind fallthrough', () => {
    const props = boxProps({ type: 'Row', children: [] } as never, 'light');
    expect('direction' in props).toBe(false);
    expect(Object.values(props).every(v => v !== undefined)).toBe(true);
  });

  test('keeps defined entries', () => {
    const props = boxProps(
      { type: 'Row', children: [], gap: 12, align: 'end', justify: 'start' } as never,
      'light',
    );
    expect(props.gap).toBe(12);
    expect(props.align).toBe('end');
    expect(props.justify).toBe('start');
    expect('direction' in props).toBe(false);
    expect('background' in props).toBe(false);
  });

  test('passes an explicit direction through', () => {
    const props = boxProps(
      { type: 'Box', children: [], direction: 'row' } as never,
      'light',
    );
    expect(props.direction).toBe('row');
  });
});
