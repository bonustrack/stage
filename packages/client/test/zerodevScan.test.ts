import { describe, expect, test } from 'bun:test';
import type { PublicClient } from 'viem';
import {
  scanSmartAccounts, restoreSmartAccounts, isAddressDeployed,
  DEFAULT_GAP_LIMIT,
} from '../src/zerodev/scan';

const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

function fakeAddress(index: number): string {
  return `0x${(index + 1).toString(16).padStart(40, '0')}`;
}

const deriveAddress = (hdIndex: number): Promise<string> => Promise.resolve(fakeAddress(hdIndex));

function fakeClient(deployedAddresses: Set<string>): PublicClient {
  return {
    getCode: ({ address }: { address: string }) =>
      Promise.resolve(deployedAddresses.has(address.toLowerCase()) ? '0x60016001' : undefined),
  } as unknown as PublicClient;
}

describe('zerodev/scan', () => {
  test('isAddressDeployed reflects on-chain code presence', async () => {
    const addr = fakeAddress(0);
    expect(await isAddressDeployed(fakeClient(new Set([addr])), addr)).toBe(true);
    expect(await isAddressDeployed(fakeClient(new Set()), addr)).toBe(false);
  });

  test('scan finds all deployed indices including across a gap', async () => {
    const client = fakeClient(new Set([fakeAddress(0), fakeAddress(1), fakeAddress(2)]));
    const found = await scanSmartAccounts(client, TEST_MNEMONIC, { deriveAddress });
    expect(found.map((f) => f.hdIndex)).toEqual([0, 1, 2]);
    expect(found.every((f) => f.deployed)).toBe(true);
  });

  test('each scanned account carries the deterministic derived address + owner', async () => {
    const client = fakeClient(new Set([fakeAddress(0)]));
    const found = await scanSmartAccounts(client, TEST_MNEMONIC, { deriveAddress });
    expect(found[0].address).toBe(fakeAddress(0));
    expect(found[0].ownerAddress).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  });

  test('scan stops after gap-limit consecutive unused indices', async () => {
    const client = fakeClient(new Set([fakeAddress(0), fakeAddress(5)]));
    const found = await scanSmartAccounts(client, TEST_MNEMONIC, { gapLimit: 3, deriveAddress });
    expect(found.map((f) => f.hdIndex)).toEqual([0]);
  });

  test('scan resumes across a gap smaller than the gap limit', async () => {
    const client = fakeClient(new Set([fakeAddress(0), fakeAddress(2)]));
    const found = await scanSmartAccounts(client, TEST_MNEMONIC, { gapLimit: 3, deriveAddress });
    expect(found.map((f) => f.hdIndex)).toEqual([0, 2]);
  });

  test('scan respects maxIndex ceiling', async () => {
    const client = fakeClient(new Set([fakeAddress(0), fakeAddress(10)]));
    const found = await scanSmartAccounts(client, TEST_MNEMONIC, {
      gapLimit: 100, maxIndex: 4, deriveAddress,
    });
    expect(found.map((f) => f.hdIndex)).toEqual([0]);
  });

  test('restore falls back to index 0 when nothing is deployed yet', async () => {
    const found = await restoreSmartAccounts(fakeClient(new Set()), TEST_MNEMONIC, { deriveAddress });
    expect(found.map((f) => f.hdIndex)).toEqual([0]);
    expect(found[0].deployed).toBe(false);
    expect(found[0].address).toBe(fakeAddress(0));
  });

  test('restore returns the deployed set when accounts exist', async () => {
    const client = fakeClient(new Set([fakeAddress(0), fakeAddress(1)]));
    const found = await restoreSmartAccounts(client, TEST_MNEMONIC, { deriveAddress });
    expect(found.map((f) => f.hdIndex)).toEqual([0, 1]);
  });

  test('DEFAULT_GAP_LIMIT is a small positive integer', () => {
    expect(DEFAULT_GAP_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_GAP_LIMIT)).toBe(true);
  });
});
