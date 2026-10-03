import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConvMeta, fetchGroupRoles, messagingKeys } from '../../modules/messaging/queries';
import { groupEditRights, leaveGroupConv, removeGroupMembers } from '../../lib/xmtp.groups';
import { lineOfConv, convIdOfLine } from '@stage-labs/client/xmtp/line';
import { shortAddress } from '@stage-labs/client/identity/format';
import { convOfLine } from '../../lib/xmtp.sdk';
import { memberInboxToAddressMap } from '../../lib/xmtp.identity';
import { ensurePeerProfiles, getPeerName, subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';
import type { GroupEditRights } from '@stage-labs/client/xmtp/groups';
import { capabilities } from '../../lib/capabilities';
import { LEAVE_CHANNEL_CONFIRM } from '../ChannelMenu.model';

function convIdOf(line: string): string {
  const convId = convIdOfLine(line);
  if (!convId) throw new Error('Conversation not found');
  return convId;
}

async function sortedMembers(line: string): Promise<string[]> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const map = await memberInboxToAddressMap(conv);
  return Object.values(map).sort((a, b) => a.localeCompare(b));
}

async function removeChannelMember(line: string, addr: string): Promise<string[]> {
  await removeGroupMembers(convIdOf(line), [addr]);
  return sortedMembers(line);
}

type Roles = Record<string, 'owner' | 'admin' | 'member'>;
type Names = Record<string, string | null>;
type Meta = ReturnType<typeof useConvMeta>;
type BusyKey = 'leave';
type Task = () => Promise<Partial<Meta> | undefined>;

const NO_ROLES: Roles = {};

const NO_EDIT_RIGHTS: GroupEditRights = {
  name: false, description: false, image: false, appData: false, addMembers: false, removeMembers: false,
};

export function useChannelRoles(convId: string | undefined, inboxToAddr: Record<string, string>): Roles {
  const inboxIds = Object.keys(inboxToAddr);
  const { data = NO_ROLES } = useQuery({
    queryKey: messagingKeys.groupRoles(convId, inboxIds),
    queryFn: () => fetchGroupRoles(convId ?? '', inboxToAddr),
    enabled: !!convId && inboxIds.length > 0,
  });
  return data;
}

function useMemberDirectory(convId: string | undefined, meta: Meta): {
  members: string[]; memberNames: Names; memberRoles: Roles;
} {
  const [memberNames, setMemberNames] = useState<Names>({});
  const metaMembers = meta.memberAddrs;
  const members = useMemo(() => [...metaMembers].sort((x, y) => x.localeCompare(y)), [metaMembers]);
  const memberRoles = useChannelRoles(convId, meta.inboxToAddr);

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

export function useChannelEditRights(convId: string | undefined, enabled = true): GroupEditRights {
  const { data = NO_EDIT_RIGHTS } = useQuery({
    queryKey: messagingKeys.groupEditRights(convId),
    queryFn: () => groupEditRights(convId ?? ''),
    enabled: enabled && !!convId,
  });
  return data;
}

export function confirmMemberRemoval(names: string[]): Promise<boolean> {
  const who = names.length === 1 ? names[0] ?? '' : `${names.length} members`;
  return capabilities.confirm({
    title: names.length === 1 ? 'Remove member' : 'Remove members',
    message: `Remove ${who} from this channel? They'll lose access to past + future messages.`,
    confirmLabel: 'Remove',
    destructive: true,
  });
}

export function useChannelDetail(convId: string | undefined) {
  const router = useRouter();
  const line = lineOfConv(convId ?? '');
  const meta = useConvMeta(convId);
  const directory = useMemberDirectory(convId, meta);
  const { busy, run } = useTaskRunner(convId);
  const [removing, setRemoving] = useState<string | null>(null);
  const rights = useChannelEditRights(convId);

  const removeMember = async (addr: string): Promise<void> => {
    if (!await confirmMemberRemoval([shortAddress(addr)])) return;
    await run((on) => { setRemoving(on ? addr.toLowerCase() : null); }, 'Remove member failed', async () => (
      { memberAddrs: await removeChannelMember(line, addr) }
    ));
  };

  const leaveChannel = async (): Promise<void> => {
    const ok = await capabilities.confirm(LEAVE_CHANNEL_CONFIRM);
    if (!ok) return;
    await run('leave', 'Couldn’t leave', async () => {
      const result = await leaveGroupConv(line);
      capabilities.toast(result === 'left' ? 'Left channel' : 'Channel hidden');
      router.replace('/');
      return undefined;
    });
  };

  return {
    line, ...directory, busy, removing,
    name: meta.groupName, description: meta.groupDescription, imageUrl: meta.groupImage, rights,
    removeMember,
    leaveChannel,
  };
}
