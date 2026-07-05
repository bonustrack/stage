
import { convOfLine } from './xmtp';
import { asGroup, parseBlob, readLabels, LabelPermissionError } from './xmtp.labels';

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

function readGithub(blob: Record<string, unknown>): string | undefined {
  const raw = blob.github;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

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

export async function githubOfSyncedGroup(conv: unknown): Promise<string | undefined> {
  const group = asGroup(conv);
  if (!group) return undefined;
  try {
    return readGithub(parseBlob(await group.appData()));
  } catch {
    return undefined;
  }
}

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
