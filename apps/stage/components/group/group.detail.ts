
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConvMeta, fetchGroupRoles } from '../../modules/messaging';
import { ensurePeerProfiles, getPeerName, subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';

type Roles = Record<string, 'owner' | 'admin' | 'member'>;

const NO_ROLES: Roles = {};
type Names = Record<string, string | null>;

interface ActionSeeders {
  setName: (n: string | null) => void;
  setDraft: (n: string) => void;
  setImageUrl: (u: string) => void;
  setDescription: (d: string) => void;
  setDescriptionDraft: (d: string) => void;
  setMembers: (m: string[]) => void;
}

export function useGroupDetail(
  convId: string | undefined,
  a: ActionSeeders,
): { memberNames: Names; memberRoles: Roles } {
  const meta = useConvMeta(convId);
  const [memberNames, setMemberNames] = useState<Names>({});

  const metaMembers = meta.memberAddrs;
  const sortedMembers = useMemo(
    () => [...metaMembers].sort((x, y) => x.localeCompare(y)),
    [metaMembers],
  );

  useEffect(() => {
    a.setName(meta.groupName ?? '');
    a.setDraft(meta.groupName ?? '');
    a.setImageUrl(meta.groupImage);
    a.setDescription(meta.groupDescription);
    a.setDescriptionDraft(meta.groupDescription);
    a.setMembers(sortedMembers);
  }, [meta.groupName, meta.groupImage, meta.groupDescription, sortedMembers]);

  const inboxToAddr = meta.inboxToAddr;
  const inboxIds = Object.keys(inboxToAddr);
  const { data: memberRoles = NO_ROLES } = useQuery({
    queryKey: ['groupRoles', convId ?? '', inboxIds.sort().join(',')],
    queryFn: () => fetchGroupRoles(convId ?? '', inboxToAddr),
    enabled: !!convId && inboxIds.length > 0,
  });

  useEffect(() => {
    if (sortedMembers.length === 0) return;
    const recompute = (): void => {
      const next: Names = {};
      for (const m of sortedMembers) next[m] = getPeerName(m) ?? null;
      setMemberNames(next);
    };
    ensurePeerProfiles(sortedMembers);
    recompute();
    return subscribePeerProfiles(recompute);
  }, [sortedMembers]);

  return { memberNames, memberRoles };
}
