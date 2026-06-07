/** Group-detail data wiring, extracted from group/[convId] for the 200-line cap.
 *
 *  Stage-1 cache unification: the shared fields (name / image / description /
 *  members) come from the deduped convMeta Query - the old loadGroupDetail
 *  Promise.all is gone. This hook seeds the editable group-actions state from
 *  that query, then fetches the group's ONLY extra (admin roles) + Snapshot
 *  member names. */

import { useEffect, useMemo, useState } from 'react';
import { useConvMeta, fetchGroupRoles } from '../../modules/messaging';

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

  /** Snapshot profile names (pure enrichment; rows fall back to the address). */
  useEffect(() => {
    if (sortedMembers.length === 0) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const { readProfile } = await import('../../lib/profile');
      const profiles = await Promise.all(sortedMembers.map(m => readProfile(m).catch(() => null)));
      if (cancelled) return;
      const next: Names = {};
      for (let i = 0; i < sortedMembers.length; i++) {
        next[sortedMembers[i]!] = profiles[i]?.name?.trim() || null;
      }
      setMemberNames(next);
    })();
    return (): void => { cancelled = true; };
  }, [sortedMembers]);

  return { memberNames, memberRoles };
}
