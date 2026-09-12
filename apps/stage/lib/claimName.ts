import type { Hex } from 'viem';
import { claimMessage, stageNameOf } from '@stage-labs/client/identity/stageNames';
import { encodeSetPrimaryBasename } from '@stage-labs/client/identity/basenameWrite';
import { getActiveAccount, getActiveViemAccount } from './accounts';
import { linkProxyBase } from './historyServer';
import { invalidatePeerProfile } from './peerProfiles';
import { clearStampLookup, sendOnBase } from './profileWrite';
import { kernelClientForRecord } from './zerodev/kernelForRecord';

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

export async function ownedStageName(address: string): Promise<string | null> {
  const res = await fetch(`${linkProxyBase()}/names/status?address=${address}`, { headers: HEADERS });
  if (!res.ok) return null;
  const body = (await res.json()) as { name?: string | null };
  return body.name ?? null;
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
  const body = (await res.json().catch(() => ({}))) as { name?: string; error?: string };
  if (!res.ok || !body.name) throw new Error(body.error ?? `claim failed (${res.status})`);
  return body.name;
}

export async function setPrimaryStageName(address: string, label: string): Promise<Hex> {
  const hash = await sendOnBase(encodeSetPrimaryBasename(stageNameOf(label)));
  invalidatePeerProfile(address);
  clearStampLookup(address);
  return hash;
}
