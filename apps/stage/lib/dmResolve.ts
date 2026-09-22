import { errorMessage } from '@stage-labs/client/errors';
import {
  dmUnreachableReason, findExistingDmWithAddress, openDmWithAddress, repairDmMembership,
} from './xmtp.conv';
import { xmtpClient } from './xmtp.client';
import { perfTime } from './perf';

export type DmResolveError = 'unregistered' | 'stale-installations' | 'failed';

export type DmResolution = { convId: string } | { error: DmResolveError; detail?: string };

async function classifyUnreachable(address: string): Promise<{ error: DmResolveError }> {
  const reason = await dmUnreachableReason(address).catch(() => null);
  return { error: reason ?? 'failed' };
}

const STUB_DM_DETAIL = 'The chat exists but the contact has not joined it yet. Try again in a moment.';

async function resolveStubDm(convId: string, address: string): Promise<DmResolution> {
  const repaired = await repairDmMembership(convId, address).catch(() => false);
  if (repaired) return { convId };
  const unreachable = await classifyUnreachable(address);
  return unreachable.error === 'failed' ? { ...unreachable, detail: STUB_DM_DETAIL } : unreachable;
}

async function resolveWithClient(address: string): Promise<DmResolution> {
  const existing = await perfTime('dm.findExisting', () => findExistingDmWithAddress(address)).catch(() => null);
  if (existing?.peerJoined) return { convId: existing.convId };
  if (existing) return resolveStubDm(existing.convId, address);
  const reason = await perfTime('dm.unreachableReason', () => dmUnreachableReason(address)).catch(() => null);
  if (reason) return { error: reason };
  try {
    return { convId: await perfTime('dm.open', () => openDmWithAddress(address)) };
  } catch (err) {
    const unreachable = await classifyUnreachable(address);
    return unreachable.error === 'failed' ? { ...unreachable, detail: errorMessage(err) } : unreachable;
  }
}

export async function resolveDmConvId(address: string): Promise<DmResolution> {
  try {
    await perfTime('dm.client', () => xmtpClient());
  } catch (err) {
    return { error: 'failed', detail: errorMessage(err) };
  }
  return resolveWithClient(address);
}
