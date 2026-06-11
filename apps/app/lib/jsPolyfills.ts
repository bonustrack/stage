/** ES2023 Array polyfills for the release JS engine.
 *
 *  The Hermes build that EAS bakes into the production AAB does not implement
 *  the ES2023 change-array-by-copy methods (`Array.prototype.toReversed` et al).
 *  Several dependencies call `toReversed()` and crash the release bundle at
 *  runtime even though the dev client (newer Hermes) is fine. This installs a
 *  minimal, spec-shaped fallback before any app code runs.
 *
 *  Side-effect-only module: import it FIRST in the app entry (app/_layout.tsx). */

type AnyArray = unknown[];

if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    configurable: true,
    writable: true,
    value(this: AnyArray) {
      return Array.prototype.slice.call(this).reverse();
    },
  });
}

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    configurable: true,
    writable: true,
    value(this: AnyArray, compareFn?: (a: unknown, b: unknown) => number) {
      return Array.prototype.slice.call(this).sort(compareFn);
    },
  });
}

export {};
