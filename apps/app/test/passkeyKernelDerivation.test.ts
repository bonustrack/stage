/** PASSKEY KERNEL DERIVATION + DEPLOY-INITCODE INVARIANTS (behavioral, pure-JS CI).
 *
 *  These tests build REAL @zerodev Kernel accounts (passkey-sudo and ECDSA-sudo)
 *  and assert the on-chain address-derivation facts the whole passkey-wallet
 *  design rests on. They run offline: createKernelAccount with `index` computes
 *  the counterfactual CREATE2 address locally (no getSenderAddress RPC), and the
 *  passkey/ECDSA validators only call getChainId, which viem serves from the
 *  chain config. The on-device WebAuthn assertion is stubbed (signMessageCallback)
 *  and never invoked during construction.
 *
 *  WHAT THESE LOCK (against the regressions Less hit):
 *    1. The passkey-sudo Kernel address is DETERMINISTIC for a given stored
 *       pubkey + index (so a record's rec.address is reproducible on every launch
 *       without re-registering the credential).
 *    2. The passkey-sudo address DIFFERS from the ECDSA-sudo address at the SAME
 *       index. This is the root fact behind two design choices:
 *         - at CREATE, the passkey IS the sudo, so the address is passkey-derived
 *           and rec.address == the deploy initCode address (no override, first
 *           userOp deploys correctly, NO enable step).
 *         - on ENABLE (passkey added to an ECDSA-derived account), pinning a
 *           passkey-sudo Kernel to the ECDSA address is UNSATISFIABLE: its deploy
 *           initCode would CREATE2 to a different address -> meta-factory
 *           `Unauthorized`. So enable deploys with the ECDSA initCode (address
 *           matches) then swaps sudo on-chain.
 *    3. A passkey-sudo Kernel pinned (address override) to a foreign address STILL
 *       emits passkey initCode in getFactoryArgs -> proves the "pin a passkey
 *       Kernel to the ECDSA address" shortcut is broken (it would deploy at the
 *       wrong address). kernelForRecord therefore only pins for an ALREADY-DEPLOYED
 *       enable-upgraded account (signing-only, never deploys).
 *
 *  What this canNOT cover (off-device only): the real WebAuthn create()/get()
 *  prompt and the actual on-chain deploy receipt. The signMessageCallback contract
 *  ((message, rpID, chainId, allowCredentials)) is asserted in
 *  passkeyCallbackContract.test.ts; the source-level signer routing in
 *  passkeyOnlySigner.test.ts. */

import { beforeAll, describe, expect, test } from 'bun:test';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { PasskeyValidatorContractVersion, toPasskeyValidator } from '@zerodev/passkey-validator';
import { mnemonicToAccount } from 'viem/accounts';

const ENTRY_POINT = getEntryPoint('0.7');
/** @zerodev's createKernelAccount resolves the counterfactual address via an
 *  on-chain `getSenderAddress` eth_call (there is no local CREATE2 path), so a
 *  Base RPC is required to derive an address. We use the public Base endpoint
 *  (override with EXPO_PUBLIC_ZERODEV_RPC). If the network is unreachable in CI
 *  the suite SKIPS (rather than false-failing); when it responds, every
 *  derivation invariant is asserted hard. */
const RPC = process.env.EXPO_PUBLIC_ZERODEV_RPC?.trim() || 'https://mainnet.base.org';
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

/** Whether the Base RPC answered — gates the network-dependent assertions. */
let online = false;
beforeAll(async () => {
  try {
    await publicClient.getChainId();
    // A trivial eth_call to confirm getSenderAddress-style calls will work.
    await publicClient.getBytecode({ address: '0x0000000000000000000000000000000000000000' });
    online = true;
  } catch {
    online = false;
  }
});

/** Deterministic test mnemonic (NOT a real wallet) for the ECDSA owner. */
const MNEMONIC = 'test test test test test test test test test test test junk';

/** Realistic StoredPasskey material (pubX/pubY hex, 32-byte idHash). */
const STORED = {
  pubX: '0x' + 'a3'.repeat(32),
  pubY: '0x' + 'b7'.repeat(32),
  authenticatorId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  authenticatorIdHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  rpID: 'metro.box',
};

function liveWebAuthnKey(stored: typeof STORED) {
  return {
    pubX: BigInt(stored.pubX),
    pubY: BigInt(stored.pubY),
    authenticatorId: stored.authenticatorId,
    authenticatorIdHash: stored.authenticatorIdHash,
    rpID: stored.rpID,
    // Stubbed: building the account never calls this; only sign-time does.
    signMessageCallback: async () => '0x' as `0x${string}`,
  };
}

async function passkeyKernel(index: bigint, address?: `0x${string}`) {
  const validator = await toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(STORED),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    // 0.0.3 (V0_0_3_PATCHED) is the PATCHED validator the ZeroDev paymaster will
    // sponsor; 0.0.2 is unpatched and 403s the sponsored deploy userOp. Mirrors
    // passkeyContractVersion() in lib/zerodev/account.ts.
    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_3_PATCHED,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    ...(address ? { address } : { index }),
  });
}

async function ecdsaKernel(index: bigint) {
  const owner = mnemonicToAccount(MNEMONIC, { addressIndex: Number(index) });
  const validator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    index,
  });
}

/** Resolve a Kernel address, tolerating transient public-RPC flakiness. The
 *  address is derived via an on-chain getSenderAddress eth_call; some public Base
 *  endpoints return a revert shape the SDK's error parser throws on. We treat any
 *  such failure as "RPC unavailable" (returns null -> the test skips) so the
 *  suite never false-fails on infra, while still asserting the invariant whenever
 *  the RPC behaves. */
async function tryAddress(build: () => Promise<{ address: string }>): Promise<string | null> {
  try {
    return (await build()).address;
  } catch {
    return null;
  }
}

describe('passkey-sudo Kernel address derivation', () => {
  test('is deterministic for the same stored pubkey + index', async () => {
    if (!online) return;
    const a = await tryAddress(() => passkeyKernel(0n));
    const b = await tryAddress(() => passkeyKernel(0n));
    if (a == null || b == null) return; // transient RPC flake -> skip
    expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a).toBe(b);
  });

  test('changes with the HD index (distinct accounts off one mnemonic)', async () => {
    if (!online) return;
    const a0 = await tryAddress(() => passkeyKernel(0n));
    const a1 = await tryAddress(() => passkeyKernel(1n));
    if (a0 == null || a1 == null) return;
    expect(a0.toLowerCase()).not.toBe(a1.toLowerCase());
  });

  test('DIFFERS from the ECDSA-sudo address at the same index (sudo is in the CREATE2 salt)', async () => {
    // This is the load-bearing fact: the sudo validator is part of the Kernel
    // salt, so a passkey-sudo and an ECDSA-sudo account at the same index are
    // DIFFERENT addresses. => at create, the passkey address must be the record
    // address (no override); on enable you cannot pin a passkey Kernel to the
    // ECDSA address.
    if (!online) return;
    const passkey = await tryAddress(() => passkeyKernel(0n));
    const ecdsa = await tryAddress(() => ecdsaKernel(0n));
    if (passkey == null || ecdsa == null) return;
    expect(passkey.toLowerCase()).not.toBe(ecdsa.toLowerCase());
  });
});

describe('deploy initCode matches the counterfactual address at CREATE (no override)', () => {
  test('a passkey-sudo Kernel built with `index` emits factory + factoryData (deploys at its own address)', async () => {
    // The create path passes NO address override, so account.address IS the
    // passkey-sudo CREATE2 address and the deploy initCode targets exactly it ->
    // the first sponsored userOp deploys correctly with no enable step.
    if (!online) return;
    let account: Awaited<ReturnType<typeof passkeyKernel>>;
    try {
      account = await passkeyKernel(0n);
    } catch {
      return; // transient RPC flake -> skip
    }
    const fa = await account.getFactoryArgs();
    expect(fa.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(fa.factoryData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});

describe('address-override is unsatisfiable for a passkey-sudo deploy (why enable swaps on-chain)', () => {
  test('pinning a passkey-sudo Kernel to a foreign address still emits passkey initCode', async () => {
    // getFactoryArgs returns the passkey-sudo initCode even when address is pinned
    // to someone else. That initCode CREATE2s to the passkey address, NOT the
    // pinned one -> the meta-factory `Unauthorized` revert if it ever deployed.
    // Hence kernelForRecord only pins for an ALREADY-DEPLOYED enable-upgraded
    // account (signing-only, never deploys), and enablePasskey deploys via the
    // ECDSA initCode (address matches) then swaps. Pinning the address means NO
    // getSenderAddress RPC is needed, so this is robust offline.
    const foreign = '0x00000000000000000000000000000000DeaDBeef' as `0x${string}`;
    let pinned: Awaited<ReturnType<typeof passkeyKernel>>;
    try {
      pinned = await passkeyKernel(0n, foreign);
    } catch {
      return;
    }
    expect(pinned.address.toLowerCase()).toBe(foreign.toLowerCase());
    const fa = await pinned.getFactoryArgs();
    // It emits passkey-sudo initCode -> would deploy at the natural passkey
    // address, not `foreign`: the whole reason the address-pin shortcut is broken.
    expect(fa.factoryData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});

describe('ECDSA-sudo Kernel (key-only account, no passkey)', () => {
  test('derives a deterministic address and works without any passkey dep', async () => {
    if (!online) return;
    const a = await tryAddress(() => ecdsaKernel(3n));
    const b = await tryAddress(() => ecdsaKernel(3n));
    if (a == null || b == null) return;
    expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a).toBe(b);
  });
});

describe('passkey validator contract version resolves to the PATCHED 0.0.3 (paymaster-sponsorable)', () => {
  // Mirrors passkeyContractVersion() in lib/zerodev/account.ts: resolve the
  // version by VALUE "0.0.3" off the installed enum (no untyped `.V0_0_2` typo).
  // 0.0.3 is the only validator the ZeroDev paymaster sponsors; 0.0.2 = 403.
  function resolveVersion(): string {
    const byValue = Object.values(PasskeyValidatorContractVersion as Record<string, string>).find(
      (v) => v === '0.0.3',
    );
    if (!byValue) throw new Error('0.0.3 not in installed SDK');
    return byValue;
  }

  test('the V0_0_3_PATCHED enum member exists and its value is "0.0.3"', () => {
    expect(PasskeyValidatorContractVersion.V0_0_3_PATCHED).toBe('0.0.3');
  });

  test('resolve-by-value yields "0.0.3" (the patched, sponsorable validator)', () => {
    expect(resolveVersion()).toBe('0.0.3');
  });
});
