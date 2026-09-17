
import {
  dmUnreachableReason, findExistingDmWithAddress, openDmWithAddress, repairDmMembership,
} from './xmtp.conv';

export type DmResolveError = 'unregistered' | 'stale-installations' | 'failed';

export type DmResolution = { convId: string } | { error: DmResolveError; detail?: string };

async function classifyUnreachable(address: string): Promise<{ error: DmResolveError }> {
  const reason = await dmUnreachableReason(address).catch(() => null);
  return { error: reason ?? 'failed' };
}

async function resolveStubDm(convId: string, address: string): Promise<DmResolution> {
  const repaired = await repairDmMembership(convId, address).catch(() => false);
  if (repaired) return { convId };
  return classifyUnreachable(address);
}

export async function resolveDmConvId(address: string): Promise<DmResolution> {
  const existing = await findExistingDmWithAddress(address).catch(() => null);
  if (existing?.peerJoined) return { convId: existing.convId };
  if (existing) return resolveStubDm(existing.convId, address);
  const reason = await dmUnreachableReason(address).catch(() => null);
  if (reason) return { error: reason };
  try {
    return { convId: await openDmWithAddress(address) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const unreachable = await classifyUnreachable(address);
    return unreachable.error === 'failed' ? { ...unreachable, detail } : unreachable;
  }
}
