
import '../cryptoShim';
import { Platform } from 'react-native';
import {
  bytesToBase64Url,
  type RegisterPasskeyOptions,
  type StoredPasskey,
} from './passkeys.model';

interface ParsedPasskeyCred {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
}

interface PasskeysUtilsModule {
  signMessageWithReactNativePasskeys: unknown;
  parsePasskeyCred: (cred: unknown, rpId: string) => ParsedPasskeyCred;
}

interface PasskeysNativeModule {
  create: (request: unknown) => Promise<unknown>;
  get: (request: unknown) => Promise<unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asPasskeysUtils(mod: unknown): PasskeysUtilsModule {
  if (
    isObject(mod) &&
    'parsePasskeyCred' in mod &&
    typeof mod.parsePasskeyCred === 'function' &&
    'signMessageWithReactNativePasskeys' in mod
  ) {
    return {
      signMessageWithReactNativePasskeys: mod.signMessageWithReactNativePasskeys,
      parsePasskeyCred: mod.parsePasskeyCred as PasskeysUtilsModule['parsePasskeyCred'],
    };
  }
  throw new Error('Unexpected @zerodev/react-native-passkeys-utils shape');
}

function asPasskeysNative(mod: unknown): PasskeysNativeModule {
  if (
    isObject(mod) &&
    'create' in mod &&
    typeof mod.create === 'function' &&
    'get' in mod &&
    typeof mod.get === 'function'
  ) {
    return {
      create: mod.create as PasskeysNativeModule['create'],
      get: mod.get as PasskeysNativeModule['get'],
    };
  }
  throw new Error('Unexpected react-native-passkeys shape');
}

let resolved = false;
let cached = false;

function probe(): boolean {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = false);
  try {
    const mod: unknown = require('react-native-passkeys');
    cached =
      typeof mod === 'object' &&
      mod !== null &&
      'create' in mod &&
      typeof mod.create === 'function' &&
      'get' in mod &&
      typeof mod.get === 'function';
  } catch {
    cached = false;
  }
  return cached;
}

export function passkeysAvailable(): boolean {
  return probe();
}

export function passkeySignMessageCallback(): unknown {
  const { signMessageWithReactNativePasskeys } = asPasskeysUtils(
    require('@zerodev/react-native-passkeys-utils'),
  );
  return signMessageWithReactNativePasskeys;
}

export async function registerPasskeyCredential(
  hdIndex: number,
  opts: RegisterPasskeyOptions,
): Promise<StoredPasskey | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = asPasskeysNative(require('react-native-passkeys'));
    const { parsePasskeyCred } = asPasskeysUtils(require('@zerodev/react-native-passkeys-utils'));
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = bytesToBase64Url(challengeBytes);
    const userTag = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(4)));
    const cred = await passkey.create({
      challenge,
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      rp: { id: opts.rpId, name: 'Stage' },
      user: {
        id: bytesToBase64Url(new TextEncoder().encode(`${opts.userName}:${hdIndex}:${userTag}`)),
        name: opts.userName,
        displayName: opts.userDisplayName ?? opts.userName,
      },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    const parsed = parsePasskeyCred(cred, opts.rpId);
    return {
      pubX: `0x${parsed.pubX.toString(16)}`,
      pubY: `0x${parsed.pubY.toString(16)}`,
      authenticatorId: parsed.authenticatorId,
      authenticatorIdHash: parsed.authenticatorIdHash,
      rpID: opts.rpId,
    };
  } catch {
    return null;
  }
}

export async function assertPasskeyPresence(stored: StoredPasskey): Promise<boolean | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = asPasskeysNative(require('react-native-passkeys'));
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const assertion = await passkey.get({
      challenge: bytesToBase64Url(challengeBytes),
      rpId: stored.rpID,
      allowCredentials: [{ id: stored.authenticatorId, type: 'public-key' }],
      userVerification: 'required',
    });
    return !!assertion;
  } catch {
    return false;
  }
}
