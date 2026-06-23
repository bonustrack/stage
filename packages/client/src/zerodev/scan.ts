import type { PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { deriveOwner } from './derive';
import { createEcdsaKernel } from './account';

export interface ScannedAccount {
  hdIndex: number;
  address: string;
  ownerAddress: string;
  deployed: boolean;
}

export type AddressDeriver = (hdIndex: number) => Promise<string>;

export interface ScanOptions {
  gapLimit?: number;
  maxIndex?: number;
  deriveAddress?: AddressDeriver;
}

export const DEFAULT_GAP_LIMIT = 3;

export const DEFAULT_MAX_INDEX = 32;

export async function smartAccountAddressAt(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
): Promise<string> {
  const account = await createEcdsaKernel(publicClient, owner, hdIndex);
  return account.address.toLowerCase();
}

export async function isAddressDeployed(
  publicClient: PublicClient,
  address: string,
): Promise<boolean> {
  const code = await publicClient.getCode({ address: address as `0x${string}` });
  return !!code && code !== '0x';
}

async function scanIndex(
  publicClient: PublicClient,
  mnemonic: string,
  hdIndex: number,
  deriveAddress: AddressDeriver,
): Promise<ScannedAccount> {
  const owner = deriveOwner(mnemonic, hdIndex);
  const address = await deriveAddress(hdIndex);
  const deployed = await isAddressDeployed(publicClient, address);
  return {
    hdIndex,
    address,
    ownerAddress: owner.address.toLowerCase(),
    deployed,
  };
}

export async function scanSmartAccounts(
  publicClient: PublicClient,
  mnemonic: string,
  options: ScanOptions = {},
): Promise<ScannedAccount[]> {
  const gapLimit = options.gapLimit ?? DEFAULT_GAP_LIMIT;
  const maxIndex = options.maxIndex ?? DEFAULT_MAX_INDEX;
  const deriveAddress = options.deriveAddress
    ?? ((hdIndex: number) =>
      smartAccountAddressAt(publicClient, deriveOwner(mnemonic, hdIndex), hdIndex));
  const found: ScannedAccount[] = [];
  let consecutiveUnused = 0;
  for (let hdIndex = 0; hdIndex <= maxIndex; hdIndex += 1) {
    const scanned = await scanIndex(publicClient, mnemonic, hdIndex, deriveAddress);
    if (scanned.deployed) {
      found.push(scanned);
      consecutiveUnused = 0;
    } else {
      consecutiveUnused += 1;
      if (consecutiveUnused >= gapLimit) break;
    }
  }
  return found;
}

export async function restoreSmartAccounts(
  publicClient: PublicClient,
  mnemonic: string,
  options: ScanOptions = {},
): Promise<ScannedAccount[]> {
  const found = await scanSmartAccounts(publicClient, mnemonic, options);
  if (found.length > 0) return found;
  const owner = deriveOwner(mnemonic, 0);
  const deriveAddress = options.deriveAddress
    ?? (() => smartAccountAddressAt(publicClient, owner, 0));
  const address = await deriveAddress(0);
  return [{
    hdIndex: 0,
    address,
    ownerAddress: owner.address.toLowerCase(),
    deployed: false,
  }];
}
