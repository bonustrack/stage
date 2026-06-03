/** closeGroup — archive a request-board group by removing its members (and self). */

import { accountForCall, convOf, lineOf } from './accounts.js';
import { respond } from './wire.js';
import type { GroupLike } from './labels.js';

type Args = Record<string, unknown>;

/** Remove given member inbox ids from a group; optionally self-exit last via
 *  removeMembers([selfInboxId]) (daemon is creator/super-admin). Resolves by
 *  `line`|`groupId` like setLabels. SDK errors are reported as `{ error }`. */
export async function closeGroup(id: string, args: Args): Promise<void> {
  const { line, groupId, removeInboxIds, removeSelf } = args as {
    line?: string; groupId?: string; removeInboxIds?: string[]; removeSelf?: boolean };
  const acct = accountForCall(args as { account?: string; line?: string });
  const resolvedLine = line ?? (groupId ? lineOf(acct.cfg.id, groupId) : undefined);
  if (!resolvedLine) { respond(id, { error: 'closeGroup requires `line` or `groupId`' }); return; }

  const { conv } = await convOf(resolvedLine);
  if (!conv) { respond(id, { error: `conversation not found for ${resolvedLine}` }); return; }
  const group = conv as unknown as GroupLike;
  if (typeof group.removeMembers !== 'function') {
    respond(id, { error: 'closeGroup target is not a group (no removeMembers)' }); return;
  }
  await group.sync?.().catch(() => undefined);

  const others = (removeInboxIds ?? [])
    .filter(iid => typeof iid === 'string' && iid && iid !== acct.inboxId);
  const removed: string[] = [];
  let leftSelf = false;
  try {
    if (others.length) { await group.removeMembers(others); removed.push(...others); }
    if (removeSelf) {
      try { await group.removeMembers([acct.inboxId]); leftSelf = true; }
      catch (e) {
        // Some SDK/permission configs disallow the creator removing itself.
        respond(id, { result: {
          line: resolvedLine, id: group.id, account: acct.cfg.id, removed, leftSelf: false,
          selfRemovalError: `self-removal not supported: ${(e as Error).message}` } });
        return;
      }
    }
  } catch (err) { respond(id, { error: (err as Error).message }); return; }

  respond(id, { result: { line: resolvedLine, id: group.id, account: acct.cfg.id, removed, leftSelf } });
}
