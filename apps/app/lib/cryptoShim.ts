/** Crypto + Buffer polyfills for viem on React Native.
 *
 *  React Native does NOT ship a Web Crypto API. viem (specifically the
 *  noble-curves primitives it depends on) eagerly checks for
 *  `globalThis.crypto.getRandomValues` and throws on module import when it
 *  isn't there.
 *
 *  SECURITY: the ONLY acceptable backing for `getRandomValues` is the
 *  platform CSPRNG (Android `SecureRandom` / iOS `SecRandomCopyBytes`). We get
 *  that from `react-native-get-random-values`, whose side-effect import below
 *  installs `globalThis.crypto.getRandomValues` backed by the native module.
 *  It MUST be the very first thing this module does so that every wallet/viem
 *  module that side-effect-imports this file inherits a real CSPRNG before it
 *  ever derives a key.
 *
 *  We do NOT fall back to a non-cryptographic PRNG. Earlier revisions
 *  installed a weak (`Math`-based) shim "for dev", but RN ships no Web Crypto,
 *  so that fallback was the *active* code path in production — meaning every
 *  minted mnemonic and private key (the root of every smart account) was
 *  generated from a 128-bit non-cryptographic PRNG and was brute-forceable.
 *  A predictable seed
 *  is worse than a hard failure: a wallet that refuses to boot loses no funds,
 *  a wallet seeded with weak entropy loses all of them. So if — after the
 *  native polyfill ran — `crypto.getRandomValues` is still missing, we throw
 *  rather than mint keys we cannot trust. */

/** Side-effect import: installs `globalThis.crypto.getRandomValues` backed by
 *  the platform CSPRNG. Must run before the assertion below and before any
 *  viem import. Keep this as the first import. */
import 'react-native-get-random-values';

/** viem (and most node-leaning libs) reach for `Buffer` for hex encode/decode.
 *  React Native doesn't ship it; the `buffer` npm package is a pure-JS shim. */
import { Buffer as BufferPolyfill } from 'buffer';

const G = globalThis as {
  Buffer?: typeof BufferPolyfill;
  crypto?: Crypto;
};

if (typeof G.Buffer === 'undefined') {
  G.Buffer = BufferPolyfill;
}

/** Hard invariant: after the native polyfill above, a real CSPRNG must exist.
 *  If it doesn't (native module failed to link, unsupported runtime), refuse
 *  to continue — never silently degrade to a non-cryptographic generator. */
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
