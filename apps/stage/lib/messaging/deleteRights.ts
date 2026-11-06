import type { DeleteRights } from '@stage-labs/client/xmtp/deletions';
import { ownDeletesReady } from '../ownDeletes';
import { recover } from '../errorPolicy';
import { fetchSuperAdmins } from './groupDetails';

const NO_SUPER_ADMINS: ReadonlySet<string> = new Set();

export interface AdminLookup {
  convId: string;
  inboxToAddr: Record<string, string>;
  where: string;
}

export async function deleteRightsOf(admins: AdminLookup | null, selfInboxId: string | null): Promise<DeleteRights> {
  const [ownDeletes, superAdmins] = await Promise.all([
    ownDeletesReady(),
    admins === null ? NO_SUPER_ADMINS : fetchSuperAdmins(admins.convId, admins.inboxToAddr).catch(recover(admins.where, NO_SUPER_ADMINS)),
  ]);
  return { ownDeletes, superAdmins, selfInboxId };
}
