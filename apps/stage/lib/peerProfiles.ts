import { useEffect, useReducer } from 'react';
import { createPeerProfiles } from '@stage-labs/client/identity/peerProfiles';
import { avatarCacheKey, baseProfileClient, resolveOnchainProfile } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedName } from '@stage-labs/client/identity/namesApi';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { linkProxyBase } from './linkProxy';

const profiles = createPeerProfiles({
  resolveOnchain: (address) => resolveOnchainProfile(baseProfileClient(), address, (peer) => fetchIssuedName(linkProxyBase(), peer)),
});

export const ensurePeerProfiles = profiles.ensure;
export const seedPeerProfiles = profiles.seed;
export const peerProfileEntries = profiles.entries;
export const subscribePeerProfiles = profiles.subscribe;
export const invalidatePeerProfile = profiles.invalidate;
export const isPeerResolved = profiles.isResolved;
export const getPeerName = profiles.name;
export const getPeerDisplayName = profiles.displayName;
export const getPeerHandle = profiles.handle;
export const getPeerDescription = profiles.description;
export const getPeerAvatar = profiles.avatar;
export const getPeerProfileSource = profiles.source;
export const peerLabel = profiles.label;

export function peerAvatarUrl(address: string, displayPx: number): string {
  return stampAvatarUrl(address, displayPx, avatarCacheKey(getPeerAvatar(address)));
}

export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    return subscribePeerProfiles(() => {
      bump();
    });
  }, [key]);
  return version;
}
