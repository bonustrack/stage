/** Group GITHUB LINK — an optional GitHub issue/PR URL stored in the group's
 *  synced `appData` slot alongside labels (Linear-style linked item). Stored as
 *  the `github` key in the SAME JSON object as labels; writes MERGE so labels
 *  and any other keys survive. Back-compatible: old `{v:1,labels}` data reads as
 *  "no link". All members may edit. */

import { convOfLine } from './xmtp';
import { asGroup, parseBlob, readLabels, LabelPermissionError } from './xmtp.labels';

/** Validate + normalise a GitHub URL. Returns the cleaned URL, or '' to clear
 *  the link. Throws on a non-github.com URL so the UI can surface it. */
export function normalizeGithubUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid github.com URL.');
  }
  const host = u.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new Error('Link must be a github.com URL.');
  }
  return u.toString();
}

/** Pull the github link out of a parsed blob (string or undefined). */
function readGithub(blob: Record<string, unknown>): string | undefined {
  const raw = blob.github;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/** Read the group's GitHub link, syncing first for the latest committed state.
 *  Returns undefined for DMs, missing groups, or any read error. */
export async function getGithubLink(line: string): Promise<string | undefined> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) return undefined;
  try {
    await group.sync?.();
    return readGithub(parseBlob(await group.appData()));
  } catch {
    return undefined;
  }
}

/** Read the github link off an ALREADY-SYNCED conv (no extra sync) — mirror of
 *  labelsOfSyncedGroup, used by the channels list build. */
export async function githubOfSyncedGroup(conv: unknown): Promise<string | undefined> {
  const group = asGroup(conv);
  if (!group) return undefined;
  try {
    return readGithub(parseBlob(await group.appData()));
  } catch {
    return undefined;
  }
}

/** Set (or clear, with '') the group's GitHub link, merging into existing
 *  appData so labels/other keys survive. Throws LabelPermissionError on denial. */
export async function setGithubLink(line: string, url: string): Promise<string | undefined> {
  const clean = normalizeGithubUrl(url);
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) throw new Error('Not a group conversation');
  await group.sync?.();
  const existing = parseBlob(await group.appData());
  const blob: Record<string, unknown> = { ...existing, v: 1, labels: readLabels(existing) };
  if (clean) blob.github = clean;
  else delete blob.github;
  try {
    await group.updateAppData(JSON.stringify(blob));
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('not authorized') || msg.includes('unauthorized')) {
      throw new LabelPermissionError();
    }
    throw e;
  }
  return clean || undefined;
}
