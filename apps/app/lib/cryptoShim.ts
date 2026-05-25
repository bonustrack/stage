/** TEMPORARY shim — polyfills `crypto.getRandomValues` for viem on React Native.
 *
 *  React Native does NOT ship a Web Crypto API. viem (specifically the
 *  noble-curves primitives it depends on) eagerly checks for
 *  `globalThis.crypto.getRandomValues` and throws on module import when it
 *  isn't there. This module replaces it with a Math.random fallback so the
 *  app boots while we still need it for dev.
 *
 *  ⚠️ NOT cryptographically secure. The proper fix is to add
 *  `react-native-get-random-values` (or expo-crypto) and rebuild the APK so
 *  the polyfill is backed by the platform's CSPRNG (Android SecureRandom /
 *  iOS SecRandomCopyBytes). Until then any newly-minted wallet here is only
 *  safe for development; existing wallets that were already minted under the
 *  previous flow are unaffected (Math.random is only used at mint time). */

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

const NATIVE_CRYPTO = G.crypto;

if (!NATIVE_CRYPTO || typeof NATIVE_CRYPTO.getRandomValues !== 'function') {
  const shim = {
    getRandomValues<T extends ArrayBufferView | null>(buffer: T): T {
      if (!buffer) return buffer;
      const bytes = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    },
  } as unknown as Crypto;
  Object.defineProperty(globalThis, 'crypto', { value: shim, configurable: true });
}

export {};
