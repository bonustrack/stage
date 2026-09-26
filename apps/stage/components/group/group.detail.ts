import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConvMeta, fetchGroupRoles, groupEditRights, messagingKeys, lineOfConv, leaveGroupConv, shortAddress,
} from '../../modules/messaging';
import { ensurePeerProfiles, getPeerName, subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';
import type { GroupEditRights } from '@stage-labs/client/xmtp/groups';
import { capabilities } from '../../lib/capabilities';
import { addGroupMember, removeGroupMember } from './group.helpers';

type Roles = Record<string, 'owner' | 'admin' | 'member'>;
type Names = Record<string, string | null>;
type Meta = ReturnType<typeof useConvMeta>;
type BusyKey = 'add' | 'leave';
type Task = () => Promise<Partial<Meta> | undefined>;

const NO_ROLES: Roles = {};

const NO_EDIT_RIGHTS: GroupEditRights = { name: false, description: false, image: false };

function useMemberDirectory(convId: string | undefined, meta: Meta): {
  members: string[]; memberNames: Names; memberRoles: Roles;
} {
  const [memberNames, setMemberNames] = useState<Names>({});
  const metaMembers = meta.memberAddrs;
  const members = useMemo(() => [...metaMembers].sort((x, y) => x.localeCompare(y)), [metaMembers]);

  const inboxToAddr = meta.inboxToAddr;
  const inboxIds = Object.keys(inboxToAddr);
  const { data: memberRoles = NO_ROLES } = useQuery({
    queryKey: ['groupRoles', convId ?? '', inboxIds.sort().join(',')],
    queryFn: () => fetchGroupRoles(convId ?? '', inboxToAddr),
    enabled: !!convId && inboxIds.length > 0,
  });

  useEffect(() => {
    if (members.length === 0) return;
    const recompute = (): void => {
      const next: Names = {};
      for (const m of members) next[m] = getPeerName(m) ?? null;
      setMemberNames(next);
    };
    ensurePeerProfiles(members);
    recompute();
    return subscribePeerProfiles(recompute);
  }, [members]);

  return { members, memberNames, memberRoles };
}

export function useConvMetaPatch(convId: string | undefined): (patch: Partial<Meta>) => void {
  const queryClient = useQueryClient();
  return (patch) => {
    if (!convId) return;
    const key = messagingKeys.convMeta(convId);
    queryClient.setQueryData<Meta>(key, m => (m ? { ...m, ...patch } : m));
    void queryClient.invalidateQueries({ queryKey: key });
  };
}

function useTaskRunner(convId: string | undefined): {
  busy: Partial<Record<BusyKey, boolean>>;
  run: (track: BusyKey | ((on: boolean) => void), failTitle: string, task: Task) => Promise<boolean>;
} {
  const patchMeta = useConvMetaPatch(convId);
  const [busy, setBusy] = useState<Partial<Record<BusyKey, boolean>>>({});
  const run = async (track: BusyKey | ((on: boolean) => void), failTitle: string, task: Task): Promise<boolean> => {
    const mark = typeof track === 'function' ? track : (on: boolean): void => { setBusy(b => ({ ...b, [track]: on })); };
    mark(true);
    try {
      const patch = await task();
      if (patch) patchMeta(patch);
      return true;
    } catch (e) {
      Alert.alert(failTitle, (e as Error).message ?? 'Unknown error');
      return false;
    } finally { mark(false); }
  };
  return { busy, run };
}

export function useGroupDetail(convId: string | undefined) {
  const router = useRouter();
  const line = lineOfConv(convId ?? '');
  const meta = useConvMeta(convId);
  const directory = useMemberDirectory(convId, meta);
  const { busy, run } = useTaskRunner(convId);
  const [addDraft, setAddDraft] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const { data: rights = NO_EDIT_RIGHTS } = useQuery({
    queryKey: messagingKeys.groupEditRights(convId),
    queryFn: () => groupEditRights(convId ?? ''),
    enabled: !!convId,
  });

  const addMember = async (onSuccess?: () => void): Promise<void> => {
    const addr = addDraft.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || busy.add) {
      Alert.alert('Add member', 'Enter a valid 0x… Ethereum address.');
      return;
    }
    await run('add', 'Add member failed', async () => {
      const memberAddrs = await addGroupMember(line, addr);
      setAddDraft('');
      onSuccess?.();
      return { memberAddrs };
    });
  };

  const removeMember = async (addr: string): Promise<void> => {
    const ok = await capabilities.confirm({
      title: 'Remove member',
      message: `Remove ${shortAddress(addr)} from this group? They'll lose access to past + future messages.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await run((on) => { setRemoving(on ? addr.toLowerCase() : null); }, 'Remove member failed', async () => (
      { memberAddrs: await removeGroupMember(line, addr) }
    ));
  };

  const leaveGroup = async (): Promise<void> => {
    const ok = await capabilities.confirm({
      title: 'Leave group',
      message: 'You’ll stop receiving messages from this group. You can be re-added by a member later.',
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    await run('leave', 'Couldn’t leave', async () => {
      const result = await leaveGroupConv(line);
      capabilities.toast(result === 'left' ? 'Left group' : 'Group hidden');
      router.replace('/');
      return undefined;
    });
  };

  return {
    line, ...directory, busy, removing,
    name: meta.groupName, description: meta.groupDescription, imageUrl: meta.groupImage, rights,
    addDraft, setAddDraft, addMember, removeMember,
    leaveGroup,
  };
}
