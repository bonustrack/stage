/**
 * @file Installs the platform CSPRNG `crypto.getRandomValues` and a Buffer polyfill that viem needs on React Native.
 *  Throws rather than falling back to weak entropy, since key material must never be minted from a non-cryptographic PRNG.
 */

/** Side-effect import: installs `globalThis.crypto.getRandomValues` backed by the platform CSPRNG. Must run before the assertion below and before any viem import. Keep this as the first import. */
import 'react-native-get-random-values';

/** viem (and most node-leaning libs) reach for `Buffer` for hex encode/decode. React Native doesn't ship it; the `buffer` npm package is a pure-JS shim. */
import { Buffer as BufferPolyfill } from 'buffer';

const G = globalThis as {
  Buffer?: typeof BufferPolyfill;
  crypto?: Crypto;
};

if (typeof G.Buffer === 'undefined') {
  G.Buffer = BufferPolyfill;
}

/** Hard invariant: after the native polyfill above, a real CSPRNG must exist. If it doesn't (native module failed to link, unsupported runtime), refuse to continue — never silently degrade to a non-cryptographic generator. */
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
