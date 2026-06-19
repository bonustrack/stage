// WEB-ONLY shim for `expo-secure-store`.
//
// expo-secure-store is backed by the iOS Keychain / Android Keystore and has no
// browser implementation, so `bun run web` crashes at boot when the account gate
// persists the generated account (SecureStore.setItemAsync is not a function).
//
// This localStorage-backed stand-in lets the app boot under `expo start --web`
// for UI testing / screenshots. It is aliased in ONLY for `platform === 'web'`
// by metro.config.js; native builds keep the real Keychain-backed module. There
// is no secure storage in a browser — this is a test convenience, not a
// production secret store.

const KEY_PREFIX = 'securestore:';

function lsKey(key) {
  return KEY_PREFIX + key;
}

export async function setItemAsync(key, value /*, options */) {
  try {
    globalThis.localStorage?.setItem(lsKey(key), value);
  } catch {
    /* private-mode / quota — ignore, mirrors a best-effort store */
  }
}

export async function getItemAsync(key /*, options */) {
  try {
    return globalThis.localStorage?.getItem(lsKey(key)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteItemAsync(key /*, options */) {
  try {
    globalThis.localStorage?.removeItem(lsKey(key));
  } catch {
    /* ignore */
  }
}

export async function isAvailableAsync() {
  return typeof globalThis.localStorage !== 'undefined';
}

// Accessibility constants the app references (e.g. WHEN_UNLOCKED_THIS_DEVICE_ONLY).
// On web these are inert markers — exported so call sites type/resolve cleanly.
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS = 'ALWAYS';
export const ALWAYS_THIS_DEVICE_ONLY = 'ALWAYS_THIS_DEVICE_ONLY';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export default {
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
  isAvailableAsync,
  AFTER_FIRST_UNLOCK,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  ALWAYS,
  ALWAYS_THIS_DEVICE_ONLY,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  WHEN_UNLOCKED,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
