/** updateChannelMeta — ONE generic action to update a channel's name /
 *  description / appData. setLabels + setGithub are thin wrappers over this. */

import { accountForCall, convOf, lineOf } from './accounts.js';
import { respond } from './wire.js';
import { warmGroupName } from './conv-name.js';
import { mergeAppData, readAppData, type GroupLike } from './labels.js';

type Args = Record<string, unknown>;

/** Resolve a `line` from explicit line|groupId (groupId scoped to the call's account). */
export function resolveLine(args: Args, verb: string): string {
  const line = (args as { line?: string }).line;
  if (line) return line;
  const groupId = (args as { groupId?: string }).groupId;
  if (groupId) {
    const acct = accountForCall(args as { account?: string });
    return lineOf(acct.cfg.id, groupId);
  }
  throw new Error(`${verb} requires \`line\` or \`groupId\``);
}

/** Core mutation shared by updateChannelMeta + the setLabels/setGithub wrappers.
 *  Resolves the group, optionally updates name/description, and merges `appData`
 *  (validating/cleaning github + labels). Returns the result payload. */
export async function applyChannelMeta(
  args: { line: string; name?: string; description?: string; appData?: Record<string, unknown> },
  verb: string,
): Promise<Record<string, unknown>> {
  const { line, name, description, appData } = args;
  const { acct, conv } = await convOf(line);
  if (!conv) throw new Error(`conversation not found for ${line}`);
  const group = conv as unknown as GroupLike;
  if (typeof group.updateAppData !== 'function') {
    throw new Error(`${verb} target is not a group (no updateAppData)`);
  }
  await group.sync?.().catch(() => undefined);

  if (typeof name === 'string' && name && typeof group.updateName === 'function') {
    await group.updateName(name);
    warmGroupName(group.id, name);
  }
  if (typeof description === 'string' && typeof group.updateDescription === 'function') {
    await group.updateDescription(description);
  }

  let merged: Record<string, unknown> | undefined;
  if (appData && typeof appData === 'object' && !Array.isArray(appData)) {
    const res = mergeAppData(group.appData, appData);
    await group.updateAppData!(res.blob);
    merged = res.merged;
  } else {
    merged = readAppData(group.appData) as unknown as Record<string, unknown>;
  }

  const labels = Array.isArray(merged['labels']) ? (merged['labels'] as string[]) : [];
  const github = typeof merged['github'] === 'string' ? (merged['github'] as string) : undefined;
  return {
    line, id: group.id, account: acct.cfg.id,
    ...(typeof name === 'string' && name ? { name } : {}),
    labels, github, appData: merged,
  };
}

/** Generic channel-metadata update: name, description, and/or a merged appData patch. */
export async function updateChannelMeta(id: string, args: Args): Promise<void> {
  const line = resolveLine(args, 'updateChannelMeta');
  const { name, description, appData } = args as {
    name?: string; description?: string; appData?: Record<string, unknown> };
  const result = await applyChannelMeta({ line, name, description, appData }, 'updateChannelMeta');
  respond(id, { result });
}
