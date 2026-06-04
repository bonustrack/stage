/** setGithub — thin wrapper over updateChannelMeta: set/clear the group's linked
 *  GitHub URL in synced appData (preserving labels + other keys). */

import { respond } from './wire.js';
import { applyChannelMeta, resolveLine } from './actions-meta.js';

type Args = Record<string, unknown>;

/** Set (or clear) the group's linked GitHub URL. `url`: a github.com http(s) URL
 *  to set, '' to clear. Resolves by `line`|`groupId` like setLabels. */
export async function setGithub(id: string, args: Args): Promise<void> {
  const line = resolveLine(args, 'setGithub');
  const { url } = args as { url: string };
  if (typeof url !== 'string') throw new Error('setGithub requires a `url` string');
  const result = await applyChannelMeta({ line, appData: { github: url } }, 'setGithub');
  respond(id, { result: {
    line: result['line'], id: result['id'], account: result['account'],
    github: result['github'] } });
}
