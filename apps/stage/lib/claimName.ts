import type { Hex } from 'viem';
import type { ProfileSetup } from '../components/onboarding/Onboarding.profile.model';
import { claimMessage, fetchIssuedName, stageNameOf } from '@stage-labs/client/identity/stageNames';
import { encodeSetPrimaryBasename } from '@stage-labs/client/identity/basenameWrite';
import { getActiveAccount, getActiveViemAccount } from './accounts';
import { linkProxyBase } from './historyServer';
import { refreshProfileCaches, saveBasenameProfile, sendOnBase } from './profileWrite';
import { kernelClientForRecord } from './zerodev/kernelForRecord';
import { ignored } from './errorPolicy';

export interface NameCheck { valid: boolean; available: boolean; reason?: string }

const HEADERS = { 'content-type': 'application/json', 'x-stage-client': '1' };

async function signWithActiveAccount(message: string): Promise<{ address: Hex; signature: Hex }> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  if (active.type === 'smart') {
    const kernel = await kernelClientForRecord(active, 'sign');
    const signature = await kernel.signMessage({ message } as Parameters<typeof kernel.signMessage>[0]);
    return { address: active.address as Hex, signature };
  }
  const local = await getActiveViemAccount();
  if (!local) throw new Error('This account cannot sign messages');
  return { address: local.address, signature: await local.signMessage({ message }) };
}

export async function checkStageName(label: string): Promise<NameCheck> {
  const res = await fetch(`${linkProxyBase()}/names/check?label=${encodeURIComponent(label)}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`name service responded ${res.status}`);
  return (await res.json()) as NameCheck;
}

export function ownedStageName(address: string): Promise<string | null> {
  return fetchIssuedName(linkProxyBase(), address);
}

export async function claimStageName(label: string): Promise<string> {
  const issuedAt = Date.now();
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  const message = claimMessage({ label, address: active.address, issuedAt });
  const { address, signature } = await signWithActiveAccount(message);
  const res = await fetch(`${linkProxyBase()}/names/claim`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ label, address, issuedAt, signature }),
  });
  const body = (await res.json().catch(ignored({}, 'optional'))) as { name?: string; error?: string };
  if (!res.ok || !body.name) throw new Error(body.error ?? `claim failed (${res.status})`);
  return body.name;
}

export async function setPrimaryStageName(address: string, label: string): Promise<Hex> {
  const hash = await sendOnBase(encodeSetPrimaryBasename(stageNameOf(label)));
  refreshProfileCaches(address);
  return hash;
}

export async function applyProfileSetup(address: string, profile: ProfileSetup): Promise<void> {
  await claimStageName(profile.label);
  await setPrimaryStageName(address, profile.label);
  if (profile.displayName === undefined && profile.description === undefined && profile.image === undefined) return;
  await saveBasenameProfile(address, stageNameOf(profile.label), {
    displayName: profile.displayName, description: profile.description, image: profile.image,
  });
}
