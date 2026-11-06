import { describe, expect, test } from 'bun:test';
import { domElementOf } from '../components/dashboard/dragLift.model';

describe('domElementOf', () => {
  test('a native view is never a DOM node, even where HTMLElement exists', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
    class NativeElement {
      readonly tagName = 'RN:View';
    }
    Object.defineProperty(globalThis, 'HTMLElement', { value: NativeElement, configurable: true, writable: true });
    try {
      const view = new NativeElement();
      expect(domElementOf(view, false)).toBeNull();
      expect(domElementOf(view, true)).toBe(view as HTMLElement);
      expect(domElementOf(null, true)).toBeNull();
    } finally {
      if (saved === undefined) Reflect.deleteProperty(globalThis, 'HTMLElement');
      else Object.defineProperty(globalThis, 'HTMLElement', saved);
    }
  });
});
