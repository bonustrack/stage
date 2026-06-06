/** setPreview - thin wrapper over updateChannelMeta: set/clear the group's
 *  preview URL / deep link in synced appData (preserving labels, github + other
 *  keys). Mirrors setGithub. */

import { respond } from './wire.js';
import { applyChannelMeta, resolveLine } from './actions-meta.js';

type Args = Record<string, unknown>;

/** Set (or clear) the group's preview link. `preview` (or `url`): a URL / deep
 *  link (http(s), metro://, ...) to set, '' to clear. Resolves by
 *  `line`|`groupId` like setGithub. */
export async function setPreview(id: string, args: Args): Promise<void> {
  const line = resolveLine(args, 'setPreview');
  const a = args as { preview?: unknown; url?: unknown };
  const value = typeof a.preview === 'string' ? a.preview : a.url;
  if (typeof value !== 'string') throw new Error('setPreview requires a `preview` string');
  const result = await applyChannelMeta({ line, appData: { preview: value } }, 'setPreview');
  respond(id, { result: {
    line: result['line'], id: result['id'], account: result['account'],
    preview: result['preview'] } });
}
