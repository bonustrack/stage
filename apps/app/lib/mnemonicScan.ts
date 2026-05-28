/** HD wallet "active account" scanner for the mnemonic-import flow.
 *
 *  Given an imported BIP-39 seed phrase, we walk the standard Ethereum
 *  derivation path m/44'/60'/0'/0/i for i = 0, 1, 2, … and decide which derived
 *  accounts are "active" — i.e. worth surfacing to the user. An account counts
 *  as active when it has *either*:
 *    - a registered XMTP inbox on the network (the primary signal — this is an
 *      XMTP messenger, so an address already on XMTP is the strongest "this is a
 *      real, used account" signal), checked via the static `Client.canMessage`,
 *      which returns a {identifier → bool} map for a batch of identities; or
 *    - a Snapshot profile (name/avatar set on the Snapshot hub) — the app
 *      already resolves these for the channels list, so we reuse the same
 *      GraphQL endpoint here.
 *
 *  We use the usual HD gap-limit heuristic: keep scanning until we hit
 *  GAP_LIMIT consecutive inactive accounts, then stop. Index 0 is always
 *  returned even if inactive, so a freshly-created seed (no on-chain/XMTP
 *  footprint yet) still yields a usable first account to import. */

import './cryptoShim';
import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import { SNAPSHOT_HUB_GRAPHQL } from '@metro-labs/client/profile/snapshot';
import { deriveAddressAtIndex } from './accounts';
import type { XmtpEnv } from './xmtp';

/** Consecutive inactive accounts that end the scan. */
const GAP_LIMIT = 5;
/** Hard cap so a pathological seed can't scan forever. */
const MAX_INDEX = 30;

export interface DerivedAccount {
  index: number;
  address: string;
  /** Has a registered XMTP inbox on the network. */
  onXmtp: boolean;
  /** Has a Snapshot profile (name and/or avatar set). */
  onSnapshot: boolean;
  snapshotName?: string;
}

/** Active = reachable on XMTP or has a Snapshot profile. */
function isActive(d: DerivedAccount): boolean {
  return d.onXmtp || d.onSnapshot;
}

/** Batch-check which of the given addresses have a registered XMTP inbox.
 *  Returns a lowercased-address → bool map. Best-effort: on a network/SDK error
 *  every address reads as not-on-XMTP (the Snapshot signal still applies). */
async function xmtpReachable(
  addresses: string[],
  env: XmtpEnv,
): Promise<Record<string, boolean>> {
  try {
    const identities = addresses.map(a => new PublicIdentity(a, 'ETHEREUM'));
    const res = await Client.canMessage(env, identities);
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(res)) out[k.toLowerCase()] = !!v;
    return out;
  } catch {
    return {};
  }
}

/** Batch-fetch which of the given addresses have a Snapshot profile. Returns a
 *  lowercased-address → {name?} map (presence in the map = has a profile). */
async function snapshotProfiles(
  addresses: string[],
): Promise<Record<string, { name?: string }>> {
  const out: Record<string, { name?: string }> = {};
  try {
    const query = 'query($ids:[String]!){ users(where:{id_in:$ids}){ id name avatar } }';
    const res = await fetch(SNAPSHOT_HUB_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids: addresses.map(a => a.toLowerCase()) } }),
    });
    const json = await res.json();
    const users: { id: string; name?: string | null; avatar?: string | null }[] =
      json?.data?.users ?? [];
    for (const u of users) {
      /** A row with neither a name nor an avatar is just a placeholder — treat
       *  only profiles with some content set as a real "active" signal. */
      if (u.name || u.avatar) {
        out[(u.id ?? '').toLowerCase()] = { name: u.name ?? undefined };
      }
    }
  } catch {
    /* leave empty — XMTP signal still applies */
  }
  return out;
}

/** Scan one address index: derive it and resolve both activeness signals. */
async function probeIndex(mnemonic: string, index: number, env: XmtpEnv): Promise<DerivedAccount> {
  const address = deriveAddressAtIndex(mnemonic, index);
  const [xmtp, snap] = await Promise.all([
    xmtpReachable([address], env),
    snapshotProfiles([address]),
  ]);
  const key = address.toLowerCase();
  const snapHit = snap[key];
  return {
    index,
    address,
    onXmtp: !!xmtp[key],
    onSnapshot: !!snapHit,
    snapshotName: snapHit?.name,
  };
}

/** Walk the derivation path until GAP_LIMIT consecutive inactive accounts.
 *  `onProgress` fires after each index is probed so the UI can show a live
 *  "scanning account #i…" state and append actives as they're found. Returns
 *  only the *active* accounts (index 0 included even if inactive). */
export async function scanActiveAccounts(
  mnemonic: string,
  env: XmtpEnv = 'production',
  onProgress?: (probed: DerivedAccount, foundSoFar: DerivedAccount[]) => void,
): Promise<DerivedAccount[]> {
  const active: DerivedAccount[] = [];
  let consecutiveInactive = 0;
  for (let i = 0; i < MAX_INDEX; i++) {
    const d = await probeIndex(mnemonic, i, env);
    if (isActive(d) || i === 0) {
      active.push(d);
      consecutiveInactive = isActive(d) ? 0 : consecutiveInactive + 1;
    } else {
      consecutiveInactive += 1;
    }
    onProgress?.(d, active);
    if (consecutiveInactive >= GAP_LIMIT) break;
  }
  return active;
}
