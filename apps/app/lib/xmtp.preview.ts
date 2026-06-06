/** Group PREVIEW LINK - an optional preview URL or deep link stored in the
 *  group's synced `appData` slot alongside labels + github. Stored as the
 *  `preview` key in the SAME JSON object; writes MERGE so labels, github, and
 *  any other keys survive. Back-compatible: old data without `preview` reads as
 *  "no preview". All members may edit. Accepts http(s) URLs and metro:// (or
 *  any custom-scheme) deep links so a channel can point at a live demo. */

import { convOfLine } from './xmtp';
import { asGroup, parseBlob, readLabels, LabelPermissionError } from './xmtp.labels';

/** Validate + normalise a preview link. Returns the cleaned link, or '' to
 *  clear it. Throws on a malformed link so the UI can surface it. Accepts any
 *  parseable URL (http(s), metro://, expo-development-client, etc.). */
export function normalizePreviewUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    void new URL(trimmed);
  } catch {
    throw new Error('Enter a valid URL or deep link.');
  }
  return trimmed;
}

/** Pull the preview link out of a parsed blob (string or undefined). */
function readPreview(blob: Record<string, unknown>): string | undefined {
  const raw = blob['preview'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/** Read the group's preview link, syncing first for the latest committed state.
 *  Returns undefined for DMs, missing groups, or any read error. */
export async function getPreviewLink(line: string): Promise<string | undefined> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) return undefined;
  try {
    await group.sync?.();
    return readPreview(parseBlob(await group.appData!()));
  } catch {
    return undefined;
  }
}

/** Read the preview link off an ALREADY-SYNCED conv (no extra sync) - mirror of
 *  githubOfSyncedGroup, used by the channels list build. */
export async function previewOfSyncedGroup(conv: unknown): Promise<string | undefined> {
  const group = asGroup(conv);
  if (!group) return undefined;
  try {
    return readPreview(parseBlob(await group.appData!()));
  } catch {
    return undefined;
  }
}

/** Set (or clear, with '') the group's preview link, merging into existing
 *  appData so labels/github/other keys survive. Throws LabelPermissionError on
 *  denial. */
export async function setPreviewLink(line: string, url: string): Promise<string | undefined> {
  const clean = normalizePreviewUrl(url);
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) throw new Error('Not a group conversation');
  await group.sync?.();
  const existing = parseBlob(await group.appData!());
  const blob: Record<string, unknown> = { ...existing, v: 1, labels: readLabels(existing) };
  if (clean) blob['preview'] = clean;
  else delete blob['preview'];
  try {
    await group.updateAppData!(JSON.stringify(blob));
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('not authorized') || msg.includes('unauthorized')) {
      throw new LabelPermissionError();
    }
    throw e;
  }
  return clean || undefined;
}
