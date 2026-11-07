import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { refreshConv, useChannelEditRights, useChannelRoles, useConvDetails, useConvRow } from '../../lib/messaging/queries';
import { memberAddressesOf } from '../../lib/messaging/convRow.model';
import { removeGroupMembers } from '../../lib/xmtp.groups';
import { shortAddress } from '@stage-labs/client/identity/format';
import { ensurePeerProfiles, getPeerName, subscribePeerProfiles } from '../../lib/peerProfiles';
import { capabilities } from '../../lib/capabilities';
import { leaveChannel as leaveChannelFlow } from './channelActions';

type Roles = Record<string, 'owner' | 'admin' | 'member'>;
type Names = Record<string, string | null>;

const NO_MAP: Record<string, string> = {};

function useMemberDirectory(
  convId: string,
  row: ReturnType<typeof useConvRow>,
): { members: string[]; memberNames: Names; memberRoles: Roles } {
  const [memberNames, setMemberNames] = useState<Names>({});
  const members = useMemo(() => [...memberAddressesOf(row)].sort((x, y) => x.localeCompare(y)), [row]);
  const memberRoles = useChannelRoles(convId, row?.inboxToAddr ?? NO_MAP);

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

export function confirmMemberRemoval(names: string[]): Promise<boolean> {
  const who = names.length === 1 ? (names[0] ?? '') : `${names.length} members`;
  return capabilities.confirm({
    title: names.length === 1 ? 'Remove member' : 'Remove members',
    message: `Remove ${who} from this channel? They'll lose access to past + future messages.`,
    confirmLabel: 'Remove',
    destructive: true,
  });
}

export function useChannelDetail(convId: string) {
  const router = useRouter();
  const row = useConvRow(convId);
  const { description } = useConvDetails(convId, row);
  const directory = useMemberDirectory(convId, row);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const rights = useChannelEditRights(convId);

  const removeMember = async (addr: string): Promise<void> => {
    if (!(await confirmMemberRemoval([shortAddress(addr)]))) return;
    setRemoving(addr.toLowerCase());
    try {
      await removeGroupMembers(convId, [addr]);
      refreshConv(convId);
    } catch (e) {
      capabilities.alert('Remove member failed', errorMessage(e));
    } finally {
      setRemoving(null);
    }
  };

  const leaveChannel = (): Promise<void> => leaveChannelFlow(convId, 'chat', router, setLeaving);

  return {
    ...directory,
    leaving,
    removing,
    name: row?.groupName ?? null,
    description,
    imageUrl: row?.avatarUri ?? '',
    rights,
    removeMember,
    leaveChannel,
  };
}
