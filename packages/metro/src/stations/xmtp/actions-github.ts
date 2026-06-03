/** setGithub — set/clear the group's linked GitHub URL in synced appData. */

import { accountForCall, convOf, lineOf } from './accounts.js';
import { respond } from './wire.js';
import { labelsBlob, readAppData, normalizeGithubUrl, type GroupLike } from './labels.js';

type Args = Record<string, unknown>;

/** Set (or clear) the group's linked GitHub URL, preserving labels + other appData
 *  keys (merges via labelsBlob). `url`: a github.com http(s) URL to set, '' to
 *  clear. Resolves by `line`|`groupId` like setLabels. */
export async function setGithub(id: string, args: Args): Promise<void> {
  const { line, url } = args as { line?: string; groupId?: string; url: string };
  let resolvedLine = line;
  if (!resolvedLine && (args as { groupId?: string }).groupId) {
    const acct = accountForCall(args as { account?: string });
    resolvedLine = lineOf(acct.cfg.id, (args as { groupId: string }).groupId);
  }
  if (!resolvedLine) throw new Error('setGithub requires `line` or `groupId`');
  const normalized = normalizeGithubUrl(url); // throws on bad url; '' = clear
  const { acct, conv } = await convOf(resolvedLine);
  if (!conv) throw new Error(`conversation not found for ${resolvedLine}`);
  const group = conv as unknown as GroupLike;
  if (typeof group.updateAppData !== 'function') {
    throw new Error('setGithub target is not a group (no updateAppData)');
  }
  await group.sync?.().catch(() => undefined);
  const existing = readAppData(group.appData);
  await group.updateAppData(labelsBlob(group.appData, existing.labels, normalized));
  respond(id, { result: {
    line: resolvedLine, id: group.id, account: acct.cfg.id, github: normalized || undefined } });
}
