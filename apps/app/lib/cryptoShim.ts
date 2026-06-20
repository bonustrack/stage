
import 'react-native-get-random-values';

import { Buffer as BufferPolyfill } from 'buffer';

const G = globalThis as {
  Buffer?: typeof BufferPolyfill;
  crypto?: Crypto;
};

if (typeof G.Buffer === 'undefined') {
  G.Buffer = BufferPolyfill;
}

function assertSecureRandom(): void {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error(
      'cryptoShim: no secure crypto.getRandomValues available — refusing to ' +
        'generate keys with a non-cryptographic PRNG. Ensure ' +
        "'react-native-get-random-values' is linked and its native module is present.",
    );
  }
}

assertSecureRandom();

export {};
