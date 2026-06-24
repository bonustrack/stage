
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { PasskeyValidatorContractVersion, toPasskeyValidator } from '@zerodev/passkey-validator';

const ENTRY_POINT = getEntryPoint('0.7');
const RPC_ENV: unknown = process.env.EXPO_PUBLIC_ZERODEV_RPC;
const RPC = typeof RPC_ENV === 'string' && RPC_ENV.trim() !== '' ? RPC_ENV.trim() : 'https://mainnet.base.org';
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
        signMessageCallback: (...args: unknown[]) => {
          calls.push(args);
          return Promise.resolve('0x');
        },
      },
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_V3_1,
      validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2_UNPATCHED,
    });

    await (validator as unknown as { signMessage: (a: { message: string }) => Promise<string> })
      .signMessage({ message: '0xdeadbeef' });

    expect(calls.length).toBe(1);
    const [message, rpID, chainId, allowCredentials] = calls[0];
    expect(typeof message === 'string' || (typeof message === 'object' && message !== null)).toBe(true);
    expect(rpID).toBe(STORED.rpID);
    expect(chainId).toBe(base.id);
    expect(Array.isArray(allowCredentials)).toBe(true);
    expect((allowCredentials as { id: string; type: string }[])[0]).toEqual({
      id: STORED.authenticatorId,
      type: 'public-key',
    });
  });

  test('signMessageWithReactNativePasskeys declares the 4-arg shape', () => {
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
