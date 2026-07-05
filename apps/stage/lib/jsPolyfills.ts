
type AnyArray = unknown[];

if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    configurable: true,
    writable: true,
    value(this: AnyArray): AnyArray {
      return this.slice().reverse();
    },
  });
}

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    configurable: true,
    writable: true,
    value(this: AnyArray, compareFn?: (a: unknown, b: unknown) => number): AnyArray {
      return this.slice().sort(compareFn);
    },
  });
}

interface ImportMetaRegistry {
  url: string | null;
}
interface GlobalWithImportMetaRegistry {
  __ExpoImportMetaRegistry?: ImportMetaRegistry;
}

function repairExpoImportMetaUrlForWeb(): void {
  if (typeof document === 'undefined' || typeof location === 'undefined') return;
  const siteRootAsImportMetaBase = { url: `${location.origin}/` };
  (globalThis as GlobalWithImportMetaRegistry).__ExpoImportMetaRegistry = siteRootAsImportMetaBase;
}

repairExpoImportMetaUrlForWeb();

export {};
