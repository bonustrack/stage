

import '../cryptoShim';
import type { PublicClient } from 'viem';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { isXmtpRegistered } from '../xmtp.registered';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { reserveSmartHdIndex } from './hdIndexStore';
import { makePublicClient } from './client';
import { createEcdsaKernel } from './account';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  label?: string;
  fresh?: boolean;
}

const FRESH_SEARCH_LIMIT = 32;

async function identityInUse(publicClient: PublicClient, address: `0x${string}`): Promise<boolean> {
  const [code, registered] = await Promise.all([
    publicClient.getCode({ address }).catch(() => undefined),
    isXmtpRegistered(address).catch(() => false),
  ]);
  return (code !== undefined && code !== '0x') || registered;
}

async function pickAccount(publicClient: PublicClient, fresh: boolean): Promise<{
  hdIndex: number; owner: Awaited<ReturnType<typeof smartOwnerSigner>>; address: `0x${string}`;
}> {
  const first = await nextSmartHdIndex();
  for (let hdIndex = first; hdIndex < first + FRESH_SEARCH_LIMIT; hdIndex++) {
    const owner = await smartOwnerSigner(hdIndex);
    const { address } = await createEcdsaKernel(publicClient, owner, hdIndex);
    if (!fresh || !(await identityInUse(publicClient, address))) return { hdIndex, owner, address };
  }
  throw new Error('Could not find an unused wallet for this recovery phrase.');
}

export async function createSmartAccount(opts: CreateSmartAccountOpts = {}): Promise<AccountRecord> {
  if (!zerodevConfigured()) {
    throw new Error('Smart wallet is not configured (missing ZeroDev project).');
  }
  await ensureMnemonic();
  const publicClient = makePublicClient();
  const { hdIndex, owner, address } = await pickAccount(publicClient, opts.fresh === true);
  await reserveSmartHdIndex(hdIndex);

  const rec: AccountRecord = {
    id: address.toLowerCase(),
    address,
    type: 'smart',
    label: opts.label,
    dbDir: `xmtp-${address.toLowerCase()}`,
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    ownerAddress: owner.address.toLowerCase(),
    deployed: false,
    scwXmtp: true,
  };
  return addSmartAccount(rec);
}
