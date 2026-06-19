/** Group-detail data wiring, extracted from group/[convId] for the 200-line cap.
 *
 *  Stage-1 cache unification: the shared fields (name / image / description /
 *  members) come from the deduped convMeta Query - the old loadGroupDetail
 *  Promise.all is gone. This hook seeds the editable group-actions state from
 *  that query, then fetches the group's ONLY extra (admin roles) + Snapshot
 *  member names. */

import { useEffect, useMemo, useState } from 'react';
import { useConvMeta, fetchGroupRoles } from '../../modules/messaging';
import { ensurePeerProfiles, getPeerName, subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';

type Roles = Record<string, 'owner' | 'admin' | 'member'>;
type Names = Record<string, string | null>;

/** The subset of useGroupActions setters this hook seeds. */
interface ActionSeeders {
  setName: (n: string | null) => void;
  setDraft: (n: string) => void;
  setImageUrl: (u: string) => void;
  setDescription: (d: string) => void;
  setDescriptionDraft: (d: string) => void;
  setMembers: (m: string[]) => void;
}

/** Hook resolving a group conversation's member names and roles from metadata. */
export function useGroupDetail(
  convId: string | undefined,
  a: ActionSeeders,
): { memberNames: Names; memberRoles: Roles } {
  const meta = useConvMeta(convId);
  const [memberNames, setMemberNames] = useState<Names>({});
  const [memberRoles, setMemberRoles] = useState<Roles>({});

  /** Members pre-sorted (the old loadGroupDetail sorted Object.values too). */
  const metaMembers = meta.memberAddrs;
  const sortedMembers = useMemo(
    () => [...metaMembers].sort((x, y) => x.localeCompare(y)),
    [metaMembers],
  );

  /** Seed the inline editors from the shared convMeta query. */
  useEffect(() => {
    a.setName(meta.groupName ?? '');
    a.setDraft(meta.groupName ?? '');
    a.setImageUrl(meta.groupImage);
    a.setDescription(meta.groupDescription);
    a.setDescriptionDraft(meta.groupDescription);
    a.setMembers(sortedMembers);
  }, [meta.groupName, meta.groupImage, meta.groupDescription, sortedMembers]);

  /** Group-only extra: per-member admin roles, off the query's inbox->addr map. */
  const inboxToAddr = meta.inboxToAddr;
  useEffect(() => {
    if (!convId || Object.keys(inboxToAddr).length === 0) return;
    let cancelled = false;
    void fetchGroupRoles(convId, inboxToAddr).then(roles => {
      if (!cancelled) setMemberRoles(roles);
    });
    return (): void => { cancelled = true; };
  }, [convId, inboxToAddr]);

  /** Member display names from stamp.fyi / ENS (read-only identity; pure
   *  enrichment - rows fall back to the short address). Recomputes whenever the
   *  shared stamp cache resolves. */
  useEffect(() => {
    if (sortedMembers.length === 0) return;
    /** Recompute helper. */
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
