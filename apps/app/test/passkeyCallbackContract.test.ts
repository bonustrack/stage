/** PASSKEY SIGN CALLBACK CONTRACT (interop with @zerodev/passkey-validator).
 *
 *  When we build the WebAuthnKey we set `signMessageCallback` to
 *  @zerodev/react-native-passkeys-utils' `signMessageWithReactNativePasskeys`.
 *  toPasskeyValidator wires that callback into the validator's signMessage /
 *  signUserOperation / signTypedData. If the SDK ever changed the arguments it
 *  passes to the callback, EVERY passkey signature would silently break on-device
 *  (the validator's job is the one thing CI can't run live), so we pin the
 *  contract here against BOTH installed packages:
 *
 *    1. toPasskeyValidator INVOKES webAuthnKey.signMessageCallback with exactly
 *       (message, rpID, chainId, allowCredentials) — proven by stubbing the
 *       callback and signing through the validator, then asserting the args.
 *    2. The installed @zerodev/react-native-passkeys-utils source declares
 *       `signMessageWithReactNativePasskeys(message, rpID, chainId, allowCredentials)`
 *       — proven by reading the package source (we do NOT import it: the package
 *       transitively pulls react-native, whose Flow-typed index can't load under
 *       the bun test runtime).
 *
 *  The validator only needs getChainId; the assertion callback is stubbed and the
 *  on-device WebAuthn prompt never runs. */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { PasskeyValidatorContractVersion, toPasskeyValidator } from '@zerodev/passkey-validator';

const ENTRY_POINT = getEntryPoint('0.7');
/** toPasskeyValidator reads chainId via an RPC getChainId at build time; use the
 *  Base endpoint (override with EXPO_PUBLIC_ZERODEV_RPC) and guard offline. */
const RPC = process.env.EXPO_PUBLIC_ZERODEV_RPC?.trim() || 'https://mainnet.base.org';
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const STORED = {
  pubX: '0x' + 'a3'.repeat(32),
  pubY: '0x' + 'b7'.repeat(32),
  authenticatorId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  authenticatorIdHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  rpID: 'metro.box',
};

describe('passkey sign callback contract', () => {
  test('toPasskeyValidator invokes signMessageCallback with (message, rpID, chainId, allowCredentials)', async () => {
    let online = true;
    try {
      await publicClient.getChainId();
    } catch {
      online = false;
    }
    if (!online) return;
    const calls: unknown[][] = [];
    const validator = await toPasskeyValidator(publicClient, {
      webAuthnKey: {
        pubX: BigInt(STORED.pubX),
        pubY: BigInt(STORED.pubY),
        authenticatorId: STORED.authenticatorId,
        authenticatorIdHash: STORED.authenticatorIdHash,
        rpID: STORED.rpID,
        // Capture exactly how the SDK calls our on-device callback.
        signMessageCallback: async (...args: unknown[]) => {
          calls.push(args);
          return '0x';
        },
      },
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_V3_1,
      validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2_UNPATCHED,
    });

    // Drive a signMessage through the validator (the same path the XMTP SCW
    // signer + in-chat signMessage take).
    await (validator as unknown as { signMessage: (a: { message: string }) => Promise<string> })
      .signMessage({ message: '0xdeadbeef' });

    expect(calls.length).toBe(1);
    const [message, rpID, chainId, allowCredentials] = calls[0];
    // arg 0: the message/challenge (a string or {raw}).
    expect(typeof message === 'string' || (typeof message === 'object' && message !== null)).toBe(true);
    // arg 1: the rpID we stored.
    expect(rpID).toBe(STORED.rpID);
    // arg 2: the chain id (Base = 8453), a number.
    expect(chainId).toBe(base.id);
    // arg 3: allowCredentials scoped to our stored authenticator id.
    expect(Array.isArray(allowCredentials)).toBe(true);
    expect((allowCredentials as { id: string; type: string }[])[0]).toEqual({
      id: STORED.authenticatorId,
      type: 'public-key',
    });
  });

  test('signMessageWithReactNativePasskeys declares the 4-arg shape', () => {
    // The function we hand the SDK as signMessageCallback must accept the 4 args
    // the SDK passes (message, rpID, chainId, allowCredentials). We assert this
    // against the package SOURCE rather than importing it (importing transitively
    // loads react-native's Flow-typed index, which the bun runtime can't parse).
    const req = createRequire(import.meta.url);
    const entry = req.resolve('@zerodev/react-native-passkeys-utils');
    const root = entry.replace(/_cjs[\\/].*$/, '');
    const src = readFileSync(
      `${root}_cjs/signMessageWithReactNativePasskeys.js`,
      'utf8',
    );
    expect(src).toMatch(
      /async function signMessageWithReactNativePasskeys\(\s*message,\s*rpID,\s*chainId,\s*allowCredentials\s*\)/,
    );
  });
});
